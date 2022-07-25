import { sql2aql } from './sql-utils';

const sqls = [
  'SELECT * FROM "Order"',
  "SELECT \"customer\".code \"customer__code\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1 ORDER BY 1 ASC LIMIT 10000",
  "SELECT \"customer\".code \"customer__code\", \"customer\".name \"customer__name\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1, 2 ORDER BY 1 ASC LIMIT 10000",
  "SELECT \"customer\".\"countryOfDestination\" \"customer__country_of_destination\", count(\"customer\".id) \"customer__count\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1 ORDER BY 2 DESC LIMIT 10000"
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
  RETURN {customer__code,customer__name}`,
  `
FOR doc IN Customer
  COLLECT customer__country_of_destination = doc.countryOfDestination
  AGGREGATE customer__count = COUNT(doc.id)
  SORT customer__count DESC
  LIMIT 10000
  RETURN {customer__country_of_destination,customer__count}`
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

  it(sqls[3], () => {
    let aql = sql2aql(sqls[3]);
    // console.log(aql);
    expect(aql).toEqual(aqls[3].trim());
  });
});
