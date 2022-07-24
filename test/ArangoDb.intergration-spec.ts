/* globals describe, afterAll, beforeAll, test, expect, jest, it */
// import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ArangoDbDriver } from '../src/ArangoDbDriver';

describe('ArangoDbDriver', () => {
  // let container: StartedTestContainer;
  let arangoDbDriver: ArangoDbDriver;

  // jest.setTimeout(60 * 2 * 1000);

  // const version = process.env.TEST_ARANGODB_VERSION || '3.9.1';

  // const startContainer = () => new GenericContainer(`arangodb/arangodb:${version}`)
  //   .withEnv('ARANGO_ROOT_PASSWORD', 'dev')
  //   .withExposedPorts(8529)
  //   .withHealthCheck({
  //     test: 'curl -k --silent --fail http://localhost:8529/_api/version || exit 1',
  //     interval: 3 * 1000,
  //     startPeriod: 15 * 1000,
  //     timeout: 500,
  //     retries: 30
  //   })
  //   .withWaitStrategy(Wait.forHealthCheck())
  //   .start();

  // const createDriver = (c) => {
  //   const port = c && c.getMappedPort(8529) || 8529;

  //   return new ArangoDbDriver({
  //     url: `http://localhost:${port}`,
  //     databaseName: 'dev',
  //     auth: {
  //       username: 'dev',
  //       password: 'dev',
  //     },
  //   });
  // };

  beforeAll(async () => {
    // container = await startContainer();
    // arangoDbDriver = createDriver(container);
    arangoDbDriver = new ArangoDbDriver({
      url: `http://localhost:8529`,
      databaseName: '_system',
      auth: {
        username: 'root',
        password: 'dev',
      },
    });
    // arangoDbDriver.setLogger((msg, event) => console.log(`${msg}: ${JSON.stringify(event)}`));
  });

  it('testInstance', () => {
    expect(arangoDbDriver).toBeInstanceOf(ArangoDbDriver);
  })

  it('testConnection', async () => {
    await arangoDbDriver.testConnection();
  });

  // It's not supported in Open Distro, probably it's supported in v2 Query Engine for Open Distro
  // it('SELECT 1', async () => {
  //   await elasticSearchDriver.query('SELECT 1');
  // });

  afterAll(async () => {
    await arangoDbDriver.release();

    // if (container) {
    //   console.log('[container] Stopping');

    //   await container.stop();

    //   console.log('[container] Stopped');
    // }
  });
});
