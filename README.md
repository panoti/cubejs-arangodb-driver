<p align="center"><a href="https://cube.dev"><img src="https://i.imgur.com/zYHXm4o.png" alt="Cube.js" width="300px"></a></p>

[Website](https://cube.dev) • [Docs](https://cube.dev/docs) • [Blog](https://cube.dev/blog) • [Slack](https://slack.cube.dev) • [Discourse](https://forum.cube.dev/) • [Twitter](https://twitter.com/thecubejs)

[![npm version](https://badge.fury.io/js/arangodb-cubejs-driver.svg)](https://badge.fury.io/js/arangodb-cubejs-driver)
[![Test CI](https://github.com/panoti/cubejs-arangodb-driver/actions/workflows/test.yml/badge.svg)](https://github.com/panoti/cubejs-arangodb-driver/actions/workflows/test.yml)

# Cube.js Arango Database Driver

**Project is WIP. We've already used in our production but some Postgresql do not transpile to AQL**
because we don't use all of SQL statements in our product now.

```
npm i --save arangodb-cubejs-driver
```

### What's in this repository

* ArangoDB driver in Typescript :heart:
* Docker image `ghcr.io/panoti/cube:main`. This is a custom image of `cube:latest` with `arangodb-cubejs-driver` 

### Usage

#### For Docker

Create custom image with `Dockerfile`

```Dockerfile
FROM cubejs/cube:latest

RUN npm i arangodb-cubejs-driver
```

Package `arangodb-cubejs-driver` will install into `/cube/cnf/node_modules` directory and CubeJS load driver automatically.

**Note**: This driver isn't supported by front-end so we can not use connection wizard to config arango data source. Please use env instead.

```yaml
environment:
  - CUBEJS_DB_URL=http://localhost:8529
  - CUBEJS_DB_NAME=test
  - CUBEJS_DB_USER=test
  - CUBEJS_DB_PASS=test
  - CUBEJS_DB_TYPE=arangodb
```

[Learn more](https://github.com/cube-js/cube.js#getting-started)

### License

Cube.js Arango driver is [Apache 2.0 licensed](./LICENSE).
