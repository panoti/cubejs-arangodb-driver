import { BaseDriver, DownloadQueryResultsOptions, DownloadQueryResultsResult, QueryOptions, Row, TableColumn, TableStructure } from '@cubejs-backend/base-driver';
import { CollectionType, Database } from 'arangojs';
import { Config } from 'arangojs/connection';
import { sql2aql } from './sql-utils';

export declare type TableMap = Record<string, TableColumn[]>;
export declare type SchemaStructure = Record<string, TableMap>;

const ArangoToGenericType = {
  number: 'double',
  string: 'text',
  bool: 'boolean'
};

const sortByKeys = (unordered: any) => {
  const ordered: any = {};

  Object.keys(unordered).sort().forEach((key) => {
    ordered[key] = unordered[key];
  });

  return ordered;
};

export class ArangoDbDriver extends BaseDriver {
  /**
   * Returns default concurrency value.
   * @return {number}
   */
  public static getDefaultConcurrency(): number {
    return 2;
  }

  public static driverEnvVariables() {
    return [
      'CUBEJS_DB_URL',
    ];
  }

  private config: Config;

  private client: Database;

  public constructor(
    config: Partial<Config> & {
      /**
         * Time to wait for a response from a connection after validation
         * request before determining it as not valid. Default - 60000 ms.
         */
      testConnectionTimeout?: number,
    } = {}
  ) {
    super({
      testConnectionTimeout: config.testConnectionTimeout || 60000,
    });

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

  public async query<R = unknown>(_query: string, _values?: unknown[], _options?: QueryOptions): Promise<R[]> {
    // console.log(_query, _values, _options);
    const aqlQuery = sql2aql(_query);
    const cursor = await this.client.query(aqlQuery);
    const result = await cursor.all();

    await cursor.kill();

    return result;
  }

  public async downloadQueryResults(query: string, values: unknown[], _options: DownloadQueryResultsOptions): Promise<DownloadQueryResultsResult> {
    const rows = await this.query<Row>(query, values);
    const columnTypes: TableStructure = [];

    Object.entries(rows[0]).forEach((cols) => {
      const [column, value] = cols;
      const type = typeof value; // TODO: check float and integer
      const genericType = ArangoToGenericType[type];

      if (!genericType) {
        throw new Error(`Unable to translate type for column "${column}" with type: ${type}`);
      }

      columnTypes.push({ name: column, type: genericType });
    });

    return {
      rows,
      types: columnTypes
    };
  };

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

      if (collectionMeta.type === CollectionType.DOCUMENT_COLLECTION) {
        schema[collection.name] = await this.tableColumnTypes(collection.name);
      }
    }

    schema = sortByKeys(schema);
    result[schemaName] = schema;

    return result;
  }

  public async tableColumnTypes(table: string): Promise<TableStructure> {
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
  }

  // public stream?: (table: string, values: unknown[], options: StreamOptions) => Promise<StreamTableData>;
  // public unload?: (table: string, options: UnloadOptions) => Promise<DownloadTableCSVData>;
  // public isUnloadSupported?: (options: UnloadOptions) => Promise<boolean>;

  public toGenericType(columnType: string): string {
    columnType = columnType.toLowerCase();

    if (columnType in ArangoToGenericType) {
      return ArangoToGenericType[columnType];
    }

    return super.toGenericType(columnType);
  }

  private async aggrAttrs(collectionName: string): Promise<Record<string, string>> {
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
    let result: Record<string, string> = { id: 'string' };

    if (cursor.hasNext) {
      result = {
        ...result,
        ...await cursor.next()
      };
    }

    await cursor.kill();
    return result;
  }
}
