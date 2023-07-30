import { capitalizeFirstLetter, isNumeric, sql2aql } from './sql-utils';

const sqls = [
  'SELECT * FROM "Order"',
  "SELECT \"customer\".code \"customer__code\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1 ORDER BY 1 ASC LIMIT 10000",
  "SELECT \"customer\".code \"customer__code\", \"customer\".name \"customer__name\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1, 2 ORDER BY 1 ASC LIMIT 10000",
  "SELECT \"customer\".\"countryOfDestination\" \"customer__country_of_destination\", count(\"customer\".id) \"customer__count\" FROM main.\"Customer\" AS \"customer\" GROUP BY 1 ORDER BY 2 DESC LIMIT 10000",
  `SELECT * FROM "Order" WHERE id = '1'`,
  `SELECT * FROM "Order" WHERE amount > 2000`,
  `SELECT * FROM "Order" WHERE amount > $1`,
  `SELECT * FROM "Order" WHERE id IS NOT NULL`,
  `SELECT * FROM "Order" WHERE id LIKE '%abc%'`,
  `SELECT * FROM "Order" WHERE id LIKE '%' || $1 || '%'`,
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
  RETURN {customer__country_of_destination,customer__count}`,
  `
FOR doc IN Order
  FILTER doc.id == '1'
  RETURN doc
`,
  `
FOR doc IN Order
  FILTER doc.amount > 2000
  RETURN doc
`,
  `
FOR doc IN Order
  FILTER doc.amount > 2000
  RETURN doc
`,
  `
FOR doc IN Order
  FILTER doc.id != null
  RETURN doc
`,
  `
FOR doc IN Order
  FILTER doc.id LIKE '%abc%'
  RETURN doc
`,
  `
FOR doc IN Order
  FILTER doc.id LIKE CONCAT(CONCAT('%', 'abc'), '%')
  RETURN doc
`,
];

describe('sql-untils', () => {
  beforeEach(async () => {
  });

  it('Integer Literals', () => {
    const testCases = [
      { value: '-10', expectation: true },
      { value: '0', expectation: true },
      { value: '5', expectation: true },
      { value: -16, expectation: true },
      { value: 0, expectation: true },
      { value: 32, expectation: true },
      { value: '0o144', expectation: true }, // Octal integer literal string
      { value: 0o144, expectation: true }, // Octal integer literal
      { value: '0xFF', expectation: true }, // Hexadecimal integer literal string
      { value: 0xFFF, expectation: true }, // Hexadecimal integer literal
    ];

    for (const testCase of testCases) {
      expect(isNumeric(testCase.value)).toEqual(testCase.expectation);
    }
  });

  it('Foating-Point Literals', () => {
    const testCases = [
      { value: '-1.6', expectation: true },
      { value: '4.536', expectation: true },
      { value: -2.6, expectation: true },
      { value: 3.1415, expectation: true },
      { value: 8e5, expectation: true },
      { value: '123e-2', expectation: true },
    ];

    for (const testCase of testCases) {
      expect(isNumeric(testCase.value)).toEqual(testCase.expectation);
    }
  });

  it('Non-Numeric values', () => {
    const testCases = [
      { value: '', expectation: false },
      { value: ' ', expectation: false },
      { value: '\t\t', expectation: false },
      { value: 'abcdefghijklm1234567890', expectation: false },
      { value: 'xabcdefx', expectation: false },
      { value: true, expectation: false },
      { value: false, expectation: false },
      { value: 'bcfed5.2', expectation: false },
      { value: '7.2acdgs', expectation: false },
      { value: undefined, expectation: false },
      { value: null, expectation: false },
      { value: NaN, expectation: false },
      { value: Infinity, expectation: false },
      { value: Number.POSITIVE_INFINITY, expectation: false },
      { value: Number.NEGATIVE_INFINITY, expectation: false },
      { value: new Date(2009, 1, 1), expectation: false },
      { value: new Object(), expectation: false },
      { value: function () { }, expectation: false },
      { value: [], expectation: false },
      { value: ['-10'], expectation: false },
      { value: ['0'], expectation: false },
      { value: ['5'], expectation: false },
      { value: [-16], expectation: false },
      { value: [0], expectation: false },
      { value: [32], expectation: false },
      { value: [1, 2], expectation: false },
    ];

    for (const testCase of testCases) {
      expect(isNumeric(testCase.value)).toEqual(testCase.expectation);
    }
  });

  it('Test capitalize first letter', () => {
    expect(capitalizeFirstLetter('abcdefghijklm1234567890')).toEqual('Abcdefghijklm1234567890');
    expect(capitalizeFirstLetter('Abcdefghijklm1234567890')).toEqual('Abcdefghijklm1234567890');
    expect(capitalizeFirstLetter('1234567890abcdefghijklm')).toEqual('1234567890abcdefghijklm');
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

  it(sqls[4], () => {
    let aql = sql2aql(sqls[4]);
    // console.log(aql);
    expect(aql).toEqual(aqls[4].trim());
  });

  it(sqls[5], () => {
    let aql = sql2aql(sqls[5]);
    // console.log(aql);
    expect(aql).toEqual(aqls[5].trim());
  });

  it(sqls[6], () => {
    let aql = sql2aql(sqls[6], [2000]);
    // console.log(aql);
    expect(aql).toEqual(aqls[6].trim());
  });

  it(sqls[7], () => {
    let aql = sql2aql(sqls[7]);
    // console.log(aql);
    expect(aql).toEqual(aqls[7].trim());
  });

  it(sqls[8], () => {
    let aql = sql2aql(sqls[8]);
    // console.log(aql);
    expect(aql).toEqual(aqls[8].trim());
  });

  it(sqls[9], () => {
    let aql = sql2aql(sqls[9], ['abc']);
    // console.log(aql);
    expect(aql).toEqual(aqls[9].trim());
  });
});
