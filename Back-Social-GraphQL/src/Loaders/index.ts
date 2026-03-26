import { connectDB } from '../config/database';
import expressLoader from './express';
import apolloLoader from './apollo';
import { Application } from 'express';
import socketLoader from './socket';
import { Server as HttpServer } from 'http';
import redisLoader from './redis';
import storageLoader from './storage';

export default async ({ expressApp, httpServer }: { expressApp: Application , httpServer: HttpServer }) => {
  await connectDB();
  
  const { server, schema } = await apolloLoader();
  
  expressLoader({ app: expressApp });
  console.log('Express loaded');

 socketLoader({ httpServer, schema });
 console.log('Socket loaded');

 const liveRedis = await redisLoader();
 console.log('Redis loaded');

 await storageLoader(); 
 console.log('Bucket loaded');


  return { server, schema ,liveRedis};
};