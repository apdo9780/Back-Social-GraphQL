import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../graphql/schema';
import { resolvers } from '../graphql/resolvers';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

export default async () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({ 
  schema,

  introspection: true, 
  
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({ 
      embed: true,
      footer: false 
    })
  ], 
});
  await server.start();
  
  return { server, schema };
}