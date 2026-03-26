import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { PutBucketPolicyCommand } from '@aws-sdk/client-s3';

dotenv.config();

// 1. تعريف الـ Client بره عشان نعمله Export
export const s3Client = new S3Client({
  region: process.env.region,
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123',
  },
  forcePathStyle: true,
});

export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'social-media-uploads';
    const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { AWS: ["*"] },
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/avatars/*`,
        `arn:aws:s3:::${BUCKET_NAME}/posts/*`
      ], // السماح بقراءة أي ملف جوه الباكيت
    },
  ],
};

// 2. الفانكشن اللي هتقوم مع بداية السيرفر
export default async (): Promise<void> => {
  try {



    // السطر ده بيسأل MinIO: هل الباكيت ده موجود؟
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✌️ MinIO Storage Connected (Bucket: ${BUCKET_NAME})`);
  } catch (error: any) {
    // لو الباكيت مش موجود (Error 404)، اللودر هيعمله تلقائي!
    if (error.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket '${BUCKET_NAME}' not found. Creating it automatically...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✌️ Bucket '${BUCKET_NAME}' created successfully!`);
    } else {
      console.error('MinIO Storage Connection Error:', error);
      process.exit(1);
    }
  }
  finally{
   await s3Client.send(new PutBucketPolicyCommand({
  Bucket: BUCKET_NAME,
  Policy: JSON.stringify(policy),
}));
  }
};