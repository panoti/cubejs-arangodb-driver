import { Expr, From, parse, SelectedColumn, Statement } from 'pgsql-ast-parser';

const indentMap: { [len in number]: string } = {};

export function indent(level: number, size = 2) {
  if (!indentMap[level]) {
    indentMap[level] = ' '.repeat(level * size);
  }

  return indentMap[level];
}

export function mapFromStatment(fromAst: From[], docRef = 'doc') {
  if (fromAst.length !== 1) {
    throw new Error(`Invalid from ast! ${fromAst.length} statement(s)`);
  }

  return `FOR ${docRef} IN ${fromAst[0]['name']['name']}`;
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

export function mapProjectStatement(columns: SelectedColumn[], docRef = 'doc') {
  if (columns.length === 1 && columns[0].expr.type === 'ref') {
    return `RETURN ${docRef}`
  }

  const returnArr: string[] = [];

  for (const col of columns) {
    switch (col.expr.type) {
      case 'ref':
        returnArr.push(`${col.alias}: ${col.expr.name}`);
        break;
    
      default:
        break;
    }
  }

  return `{${returnArr.join(',')}}`;
}

export function sql2aql(sql: string): string {
  const ast = parse(sql);
  let aqlQuery = '';

  let firstAst = ast[0];
  if (firstAst.type === 'select') {
    let docRef = 'doc';
    aqlQuery = `${mapFromStatment(firstAst.from, docRef)}\n`;

    if (firstAst.where) {
      let filterStr = mapWhereStatement(firstAst.where);

      if (filterStr) {
        aqlQuery += `${indent(1)}${filterStr}`;
      }
    }

    aqlQuery += `${indent(1)}${mapProjectStatement(firstAst.columns)}`;
  }

  return aqlQuery;
}