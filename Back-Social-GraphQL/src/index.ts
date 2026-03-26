import express from 'express';

import dotenv from 'dotenv';

import { createServer } from 'http';

import loaders from './Loaders/index';
import { GraphQLContext } from './types/context';
import { graphqlUploadExpress } from 'graphql-upload-ts';
import { expressMiddleware } from '@apollo/server/express4';
import { getUserFromBearerAuthHeader } from './auth/auth-context';

dotenv.config();

async function start(): Promise<void> {
  const app = express()
  
// node is the main server and it is opnning the port by listnning 
  const httpServer = createServer(app);

  const {server} = await loaders({ expressApp: app, httpServer });


app.use(graphqlUploadExpress({ 
  maxFileSize: 5 * 1024 * 1024, 
  maxFiles: 2 
}));


app.use(express.json());

app.use(
  '/graphql',
  expressMiddleware(server, {
    context: async ({ req }): Promise<GraphQLContext> => {
      const authorization = (req as any)?.headers?.authorization;
      const user = await getUserFromBearerAuthHeader(authorization);
      return { user };
    }
  })
);

  const PORT = Number(process.env.PORT) || 4000;
  httpServer.listen(PORT, () => {
    console.log(`GraphQL server ready at http://localhost:${PORT}/graphql`);
    console.log(`GraphQL WS ready at ws://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

