import { DownloadQueryResultsOptions, DownloadQueryResultsResult, DownloadTableCSVData, DownloadTableData, DownloadTableMemoryData, DriverInterface, ExternalDriverCompatibilities, IndexesSQL, QueryOptions, StreamOptions, StreamTableData, TableColumn, TableStructure, UnloadOptions } from '@cubejs-backend/query-orchestrator';
import { CollectionType, Database } from 'arangojs';
import { Config } from 'arangojs/connection';
import { ArangoDbQuery } from './arangodb-query';
import { sql2aql } from './sql-utils';

export declare type TableMap = Record<string, TableColumn[]>;
export declare type SchemaStructure = Record<string, TableMap>;

const DbTypeToGenericType = {
  number: 'double',
  string: 'text',
  bool: 'boolean'
};

const sortByKeys = (unordered) => {
  const ordered = {};

  Object.keys(unordered).sort().forEach((key) => {
    ordered[key] = unordered[key];
  });

  return ordered;
};

export class ArangoDbDriver implements DriverInterface {
  /**
   * Returns default concurrency value.
   */
  public static getDefaultConcurrency(): number {
    return 2;
  }

  public static driverEnvVariables() {
    return [
      'CUBEJS_DB_URL'
    ];
  }

  public static dialectClass() {
    return ArangoDbQuery;
  }

  private config: Config;

  private client: Database;

  public constructor(config: Config = {}) {
    const auth = {
      username: process.env.CUBEJS_DB_USER,
      password: process.env.CUBEJS_DB_PASS,
    };

    this.config = {
      url: process.env.CUBEJS_DB_URL,
      databaseName: process.env.CUBEJS_DB_NAME,
      auth,
      ...config
    };

    this.client = new Database({
      url: this.config.url,
      databaseName: this.config.databaseName,
      auth: this.config.auth,
      // ssl: this.config.ssl
    });
  }

  public async testConnection() {
    const cursor = await this.client.query({
      query: 'RETURN @value',
      bindVars: { value: Date.now() }
    });

    return await cursor.next();
  }

  public async release() {
    await this.client.close();
  }

  public readOnly() {
    // ArangoDb don't support table creation
    return true;
  }

  public async tablesSchema() {
    const result: SchemaStructure = {};
    const collections = await this.client.collections();
    const schemaName = this.config.databaseName;

    let schema = (result[schemaName] || {});

    for (const collection of collections) {
      const collectionMeta = await collection.get();

      if (collectionMeta.type !== CollectionType.DOCUMENT_COLLECTION) continue;

      schema[collection.name] = await this.tableColumnTypes(collection.name);
    }

    schema = sortByKeys(schema);
    result[schemaName] = schema;

    return sortByKeys(result);
  }

  public async createSchemaIfNotExists(schemaName: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  public async uploadTableWithIndexes(table: string, columns: TableStructure, tableData: DownloadTableData, indexesSql: IndexesSQL, uniqueKeyColumns: string[], queryTracingObj: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public loadPreAggregationIntoTable: (preAggregationTableName: string, loadSql: string, params: any, options: any) => Promise<any> =
    async (preAggregationTableName: string, loadSql: string, params: any, options: any) => {
      throw new Error('Method not implemented.');
    };

  public async query<R = unknown>(query: string, params: unknown[], options?: QueryOptions): Promise<R[]> {
    console.log(query, params, options);
    const aqlQuery = sql2aql(query);
    const cursor = await this.client.query(aqlQuery);
    const result = cursor.all();

    await cursor.kill();

    return result;
  }

  public tableColumnTypes: (table: string) => Promise<TableStructure> =
    async (table: string) => {
      const columns: TableStructure = [];
      // TODO: can optimize by schema registry or swagger json schema
      const attrMap = await this.aggrAttrs(table);
      const attrNames = Object.keys(attrMap);

      for (const attrName of attrNames) {
        const attrType = attrMap[attrName];

        if (this.toGenericType(attrType)) {
          columns.push({ name: attrName, type: attrType, attributes: [] });
        }
      }

      return columns.sort();
    };

  public getTablesQuery: (schemaName: string) => Promise<{ table_name?: string; TABLE_NAME?: string; }[]> =
    async (schemaName: string) => {
      const collections = await this.client.collections();
      return collections.map((col) => ({ table_name: col.name }));
    };

  public dropTable: (tableName: string, options?: QueryOptions) => Promise<unknown> =
    (tableName: string, options?: QueryOptions) => {
      throw new Error('Method not implemented.');
    };

  public downloadQueryResults: (query: string, values: unknown[], options: DownloadQueryResultsOptions) => Promise<DownloadQueryResultsResult> =
    async (query: string, values: unknown[], options: DownloadQueryResultsOptions) => {
      throw new Error('Method not implemented.');
    };

  public downloadTable: (table: string, options: ExternalDriverCompatibilities) => Promise<DownloadTableMemoryData | DownloadTableCSVData> =
    async (table: string, options: ExternalDriverCompatibilities) => {
      throw new Error('Method not implemented.');
    };

  // public stream?: (table: string, values: unknown[], options: StreamOptions) => Promise<StreamTableData>;
  // public unload?: (table: string, options: UnloadOptions) => Promise<DownloadTableCSVData>;
  // public isUnloadSupported?: (options: UnloadOptions) => Promise<boolean>;

  public nowTimestamp(): number {
    return Date.now();
  }

  // TODO: add to interface too
  public quoteIdentifier(identifier: string) {
    return `"${identifier}"`;
  }

  private async aggrAttrs(collectionName: string) {
    const cursor = await this.client.query(`
FOR i IN [1]
  LET attrMaps = (
    FOR doc in ${collectionName}
      LET attributes = (
        FOR name IN ATTRIBUTES(doc, true)
          RETURN {
            name: name,
            type: TYPENAME(doc[name])
          }
      ) 
      RETURN ZIP(attributes[*].name, attributes[*].type)
  )
  RETURN MERGE(attrMaps)`);
    let result: any = { id: 'string' };

    if (cursor.hasNext) {
      result = {
        ...result,
        ...await cursor.next()
      };
    }

    await cursor.kill();
    return result;
  }

  private toGenericType(columnType) {
    return DbTypeToGenericType[columnType.toLowerCase()] || columnType;
  }
}
