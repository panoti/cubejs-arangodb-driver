const { Database } = require('arangojs');

async function run() {
  this.client = new Database({
    url: 'http://dev.altimatetek.work:8529',
    databaseName: 'vhppdev',
    auth: {
      username: 'dev',
      password: 'dev'
    },
    // ssl: this.config.ssl
  });

  const collections = await this.client.collections();

  for (const collection of collections) {
    const cursor = await this.client.query(`
FOR i IN [1]
  LET attrMaps = (
    FOR doc in ${collection.name}
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
  const data= await collection.get();

    // const data = await collection;
    console.log(collection.name, data.type, await cursor.next());

    break;
  }

  await this.client.close();
}

run();