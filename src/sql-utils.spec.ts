import { sql2aql } from './sql-utils';

const sqls = [
  'SELECT * FROM "Order"',
  "SELECT \"customer\".code \"customer__code\" FROM vhppdev.\"Customer\" AS \"customer\" GROUP BY 1 ORDER BY 1 ASC LIMIT 10000",
  "SELECT \"customer\".code \"customer__code\", \"customer\".name \"customer__name\" FROM vhppdev.\"Customer\" AS \"customer\" GROUP BY 1, 2 ORDER BY 1 ASC LIMIT 10000"
];

const aqls = [
  `
FOR doc IN Order
  RETURN doc
`,
  `
FOR doc IN Customer
  COLLECT customer__code = doc.code
  SORT customer__code ASC
  LIMIT 10000
  RETURN {customer__code}
`,
  `
FOR doc IN Customer
  COLLECT customer__code = doc.code,customer__name = doc.name
  SORT customer__code ASC
  LIMIT 10000
  RETURN {customer__code,customer__name}`
];

describe('sql-untils', () => {
  beforeEach(async () => {
  });

  it(sqls[0], () => {
    let aql = sql2aql(sqls[0]);
    // expect(typeof aql).toBe('string');
    expect(aql).toEqual(aqls[0].trim());
  });

  it(sqls[1], () => {
    let aql = sql2aql(sqls[1]);
    expect(aql).toEqual(aqls[1].trim());
  });

  it(sqls[2], () => {
    let aql = sql2aql(sqls[2]);
    expect(aql).toEqual(aqls[2].trim());
  });
});
