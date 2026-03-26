import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../graphql/schema';
import { resolvers } from '../graphql/resolvers';

export default async () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const server = new ApolloServer({ schema });
  await server.start();
  
  return { server, schema };
}