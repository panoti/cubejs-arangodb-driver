import { sql2aql } from './sql-utils';

const sqls = [
  'SELECT * FROM "Order"'
];

const aqls = [
  `
FOR doc IN Order
  RETURN doc
`
];

describe('sql-untils', () => {
  beforeEach(async () => {
  });

  it(sqls[0], () => {
    let aql = sql2aql(sqls[0]);
    expect(aql).toEqual(aqls[0].trim());
  });
});
