import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

export default ({ app }: { app: express.Application }) => {
  app.use(morgan('dev'));
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4200',
    credentials: true
  }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Return the app for chaining
  return app;
};