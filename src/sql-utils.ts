import { Expr, From, LimitStatement, OrderByStatement, parse, SelectedColumn } from 'pgsql-ast-parser';

interface AqlContext {
  docRef: string;
  collectMap?: Record<string, String>;
}

const functionMap: Record<string, string> = {
  count: 'COUNT',
  countDistinct: 'COUNT_DISTINCT',
  min: 'MIN',
  max: 'MAX',
  sum: 'SUM',
  avg: 'AVG'
};

const operatorMap: Record<string, string> = {
  '=': '==',
  'ILIKE': 'LIKE',
  'NOT ILIKE': 'NOT LIKE'
};

const indentMap: Record<number, string> = {};

export function indent(level: number, size = 2) {
  if (!indentMap[level]) {
    indentMap[level] = ' '.repeat(level * size);
  }

  return indentMap[level];
}

export function isNumeric(val: any): boolean {
  // // See also: https://github.com/angular/angular/blob/c1052cf7a77e0bf2a4ec14f9dd5abc92034cfd2e/packages/common/src/pipes/number_pipe.ts#L289C7-L289C77
  // typeof value === 'string' && !isNaN(Number(value) - parseFloat(value))
  return !(val instanceof Array) && (val - parseFloat(val) + 1) >= 0;
}

export function capitalizeFirstLetter(string: string): string {
  return string ? string[0].toUpperCase() + string.slice(1) : '';
}

export function hasCalculatedColumns(columns: SelectedColumn[]): boolean {
  for (const col of columns) {
    if (col.expr.type === 'call') {
      return true;
    }
  }

  return false;
}

export function mapFromStatment(fromAst: From[], ctx: AqlContext) {
  if (fromAst.length !== 1) {
    throw new Error(`Invalid from ast! ${fromAst.length} statement(s)`);
  }

  return `FOR ${ctx.docRef} IN ${fromAst[0]['name']['name']}`;
}

function mapOpStat(expr: Expr, params: unknown[], ctx: AqlContext, deep = 0) {
  switch (expr.type) {
    case 'ref': {
      return `${ctx.docRef}.${expr.name}`;
    }

    case 'parameter': {
      if (expr.name[0] === '$') {
        // SQL positional parameter, e.g. {"type":"parameter","name":"$1"}
        // Remove leading $, convert to numeric (+), adjust to zero-based index (-1).
        const position = +expr.name.substring(1) - 1;
        const value: any = params[position];

        if (isNumeric(value)) {
          return +value;
        } else if (typeof value === 'string') {
          return `'${value}'`;
        }

        return value;
      } else {
        throw Error(`Unsupported parameter ${JSON.stringify(params)}`);
      }
    }

    case 'boolean':
    case 'integer':
      return expr.value;

    case 'string':
      return `'${expr.value}'`;

    case 'unary': {
      // Extract operand value by recursive call to current function.
      const operand = mapOpStat(expr.operand, params, ctx);

      switch (expr.op) {
        case 'IS NULL':
          return `${operand} == null`;
        case 'IS NOT NULL':
          return `${operand} != null`;
        default:
          throw Error(`Unsupported operator ${expr.op}!`);
      }
    }

    case 'binary': {
      // Extract operator value with substitution.
      const op = operatorMap[expr.op] || expr.op;
      // Extract operands' values by recursive call to current function.
      const lhs = mapOpStat(expr.left, params, ctx);
      const rhs = mapOpStat(expr.right, params, ctx);

      if (op === '||') {
        // lhs or rhs is a wildcard literal ('%') to append for searching with LIKE.
        return `CONCAT(${lhs}, ${rhs})`;
      }

      return deep > 0 ? `(${lhs} ${op} ${rhs})` : `${lhs} ${op} ${rhs}`;
    }

    default:
      throw Error(`Unsupported where expr type ${expr.type}!`);
  }
}

export function mapWhereStatement(whereAst: Expr, params: unknown[], ctx: AqlContext): string {
  let filterStr = mapOpStat(whereAst, params, ctx);

  if (filterStr) {
    return `FILTER ${filterStr}`;
  }

  throw Error(`Unsupported filter string ${JSON.stringify(whereAst)}`);
}

export function mapGroupByStatement(groupByAsts: Expr[], columns: SelectedColumn[], ctx: AqlContext) {
  const collectArr: string[] = [];
  ctx.collectMap = {};

  if (groupByAsts) {
    // Transpile GROUP BY SQL columns to COLLECT and RETURN AQL columns. RETURN columns are passed via collectMap.
    for (const groupByAst of groupByAsts) {
      switch (groupByAst.type) {
        case 'integer':
          const groupCol = columns[groupByAst.value - 1];
          const collectEl = `${groupCol.alias.name} = ${ctx.docRef}.${groupCol.expr['name']}`;
          ctx.collectMap[groupCol.alias.name] = collectEl;
          collectArr.push(collectEl);
          break;

        default:
          throw Error(`Unsupported groupBy expr type ${groupByAst.type}!`);
      }
    }
  }

  // Return one of the following:
  // - COLLECT followed by columns if there are GROUP BY in SQL.
  // - COLLECT statement if there are only calculated columns for further representation by AGGREGATE AQL.
  return `COLLECT ${collectArr.join(',')}`;
}

export function mapAggrStatement(columns: SelectedColumn[], ctx: AqlContext) {
  let aggArr: string[] = [];

  for (const col of columns) {
    if (col.expr.type === 'call') {
      let aqlFunc = functionMap[col.expr.function.name + capitalizeFirstLetter(col.expr.distinct)];
      if (aqlFunc) {
        let aggrEl = `${col.alias.name} = ${aqlFunc}(${col.expr.args.map((expr) => `${ctx.docRef}.${expr['name']}`).join(',')})`;
        ctx.collectMap[col.alias.name] = aggrEl;
        aggArr.push(aggrEl);
      } else {
        throw Error(`AQL mapping is missing for SQL function ${col.expr.function.name}`);
      }
    }
  }

  if (aggArr.length) {
    return `AGGREGATE ${aggArr.join(',')}`;
  }

  return undefined;
}

export function mapOrderByStatement(orderByAsts: OrderByStatement[], columns: SelectedColumn[], ctx: AqlContext) {
  const orderByArr: string[] = [];

  for (const orderByAst of orderByAsts) {
    switch (orderByAst.by.type) {
      case 'integer':
        const orderCol = columns[orderByAst.by.value - 1];
        const orderByEl = `${orderCol.alias.name} ${orderByAst.order}`;
        // ctx.collectMap[groupCol.alias.name] = collectEl;
        orderByArr.push(orderByEl);
        break;

      default:
        throw Error(`Unsupported orderBy by type ${orderByAst.by.type}!`);
    }
  }

  return `SORT ${orderByArr.join(',')}`;
}

export function mapLimitStatement(limitAst: LimitStatement) {
  let limitStr = '';

  if (limitAst.limit) {
    switch (limitAst.limit.type) {
      case 'integer':
        limitStr = `${limitAst.limit.value}`;
        break;

      default:
        throw Error(`Unsupported limit type ${limitAst.limit.type}!`);
    }
  }

  return `LIMIT ${limitStr}`;
}

export function mapProjectStatement(columns: SelectedColumn[], ctx: AqlContext) {
  if (columns.length === 1 && columns[0].expr.type === 'ref' && columns[0].expr.name === '*') {
    return `RETURN ${ctx.docRef}`;
  }

  const returnArr: string[] = [];

  for (const col of columns) {
    if (ctx.collectMap && ctx.collectMap[col.alias.name]) {
      returnArr.push(`${col.alias.name}`);
    } else {
      switch (col.expr.type) {
        case 'ref':
          returnArr.push(`${col.alias.name}:${ctx.docRef}.${col.expr.name}`);
          break;
        case 'call':
          // Handled in COLLECT and AGGREGATE AQL transpilers of mapGroupByStatement() and mapAggrStatement().
          break;
        default:
          throw Error(`Unsupported projection expr type ${col.expr.type}!`);
      }
    }
  }

  return `RETURN {${returnArr.join(',')}}`;
}

export function sql2aql(sql: string, params: unknown[] = []): string {
  const ast = parse(sql);
  let aqlQuery = '';
  let firstAst = ast[0];

  if (firstAst.type === 'select') {
    let ctx: AqlContext = { docRef: 'doc' };

    aqlQuery = `${mapFromStatment(firstAst.from, ctx)}\n`;

    if (firstAst.where) {
      let filterStr = mapWhereStatement(firstAst.where, params, ctx);

      if (filterStr) {
        aqlQuery += `${indent(1)}${filterStr}\n`;
      }
    }

    if (firstAst.groupBy || hasCalculatedColumns(firstAst.columns)) {
      aqlQuery += `${indent(1)}${mapGroupByStatement(firstAst.groupBy, firstAst.columns, ctx)}\n`;

      let aggrStr = mapAggrStatement(firstAst.columns, ctx);

      if (aggrStr) {
        aqlQuery += `${indent(1)}${aggrStr}\n`;
      }
    }

    if (firstAst.orderBy) {
      aqlQuery += `${indent(1)}${mapOrderByStatement(firstAst.orderBy, firstAst.columns, ctx)}\n`;
    }

    if (firstAst.limit) {
      aqlQuery += `${indent(1)}${mapLimitStatement(firstAst.limit)}\n`;
    }

    aqlQuery += `${indent(1)}${mapProjectStatement(firstAst.columns, ctx)}`;
  }

  return aqlQuery;
}
