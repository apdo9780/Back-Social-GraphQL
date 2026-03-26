import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// ضفنا lazyConnect: true عشان نمنع الاتصال التلقائي
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true 
});

export default async (): Promise<Redis> => {
    try {
        await redis.connect(); 
        console.log('Redis Client Connected');
        return redis;
    } catch (err) {
        console.error('Redis Client Error:', err);
        process.exit(1);
    }
};