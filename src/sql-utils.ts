import { Expr, From, LimitStatement, OrderByStatement, parse, SelectedColumn } from 'pgsql-ast-parser';

const indentMap: { [len in number]: string } = {};

interface AqlContext {
  docRef: string;
  collectMap?: Record<string, String>;
}

export function indent(level: number, size = 2) {
  if (!indentMap[level]) {
    indentMap[level] = ' '.repeat(level * size);
  }

  return indentMap[level];
}

export function mapFromStatment(fromAst: From[], ctx: AqlContext) {
  if (fromAst.length !== 1) {
    throw new Error(`Invalid from ast! ${fromAst.length} statement(s)`);
  }

  return `FOR ${ctx.docRef} IN ${fromAst[0]['name']['name']}`;
}

function mapOpStat(expr: Expr, deep = 0) {
  switch (expr.type) {
    case 'ref': {

    }

    case 'boolean':
    case 'integer':
    case 'string':
      return expr['value'];

    case 'binary': {
      const op = expr['op'];
      const lhs = mapOpStat(expr['left']);
      const rhs = mapOpStat(expr['right']);
      return deep > 0 ? `(${lhs} ${op} ${rhs})` : `${lhs} ${op} ${rhs}`;
    }

    default:
      throw Error(`Unsupported where expr type ${expr.type}!`);
  }
}

export function mapWhereStatement(whereAst: Expr) {
  let filterStr = mapOpStat(whereAst);

  if (filterStr) {
    return `FILTER ${filterStr}`;
  }

  return undefined;
}

export function mapGroupByStatement(groupByAsts: Expr[], columns: SelectedColumn[], ctx: AqlContext) {
  const collectArr: string[] = [];
  ctx.collectMap = {};

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

  return `COLLECT ${collectArr.join(',')}`;
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
    if (ctx.collectMap) {
      if (ctx.collectMap[col.alias.name]) {
        returnArr.push(`${col.alias.name}`);
      }
    } else {
      switch (col.expr.type) {
        case 'ref':
          returnArr.push(`${col.alias.name}:${ctx.docRef}.${col.expr.name}`);
          break;

        default:
          throw Error(`Unsupported projection expr type ${col.expr.type}!`);
      }
    }
  }

  return `RETURN {${returnArr.join(',')}}`;
}

export function sql2aql(sql: string): string {
  const ast = parse(sql);
  let aqlQuery = '';

  let firstAst = ast[0];
  if (firstAst.type === 'select') {
    let ctx: AqlContext = { docRef: 'doc' };
    aqlQuery = `${mapFromStatment(firstAst.from, ctx)}\n`;

    if (firstAst.where) {
      let filterStr = mapWhereStatement(firstAst.where);

      if (filterStr) {
        aqlQuery += `${indent(1)}${filterStr}\n`;
      }
    }

    if (firstAst.groupBy) {
      aqlQuery += `${indent(1)}${mapGroupByStatement(firstAst.groupBy, firstAst.columns, ctx)}\n`;
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