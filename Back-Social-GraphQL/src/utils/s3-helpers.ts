import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../Loaders/storage'; // اللودر اللي ظبطناه

/**
 * دالة لتوليد رابط مؤقت للصور الخاصة
 * @param objectKey مسار الصورة جوه الباكيت (مثال: chats/image.png)
 * @param expiresIn مدة الصلاحية بالثواني (الافتراضي 5 دقايق)
 */
export async function generatePresignedUrl(objectKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
  });

  // بنولد الرابط المشفر باستخدام الـ s3Client بتاعنا
  
  const signedUrl = await getSignedUrl(s3Client, command);
  return signedUrl;
}