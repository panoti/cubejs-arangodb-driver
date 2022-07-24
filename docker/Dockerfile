FROM cubejs/cube:latest

WORKDIR /cube

COPY DriverDependencies.js /cube/node_modules/@cubejs-backend/server-core/dist/src/core/DriverDependencies.js

RUN yarn add arangodbx-cubejs-driver && yarn cache clean

WORKDIR /cube/conf

