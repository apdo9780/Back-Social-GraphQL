import path from 'path';
import type { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { s3Client, BUCKET_NAME } from '../Loaders/storage'; // استيراد الـ Client من اللودر

export type UploadTarget = 'avatars' | 'posts';

function randomFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename) || '.jpg';
  const safeExt = ext.toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
}

export async function storeImageUpload(params: {
  target: UploadTarget;
  file: Promise<{
    filename: string;
    mimetype: string;
    createReadStream: () => Readable;
  }>;
  maxBytes?: number;
}): Promise<{ filename: string; relativeUrlPath: string }> {
  
  const maxBytes = params.maxBytes ?? 5 * 1024 * 1024;
  const { filename, mimetype, createReadStream } = await params.file;

  if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(mimetype) && !mimetype.startsWith("application") ) {
    console.log('DEBUG: Received File ->', { filename, mimetype });
    throw new Error('Only image uploads are allowed');
  }

  const finalName = randomFilename(filename);
  const objectKey = `${params.target}/${finalName}`; 
  const stream = createReadStream();

  let bytes = 0;
  stream.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      stream.destroy(new Error('File too large'));
    }
  });

  try {
    const parallelUploads3 = new Upload({
      client: s3Client, // استخدمنا الـ Client اللي جاي من اللودر
      params: {
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: stream,
        ContentType: mimetype,
      },
    });

    await parallelUploads3.done();
  } catch (error) {
    console.error('Error uploading to MinIO:', error);
    throw new Error('Failed to upload image to storage');
  }

  return { filename: finalName, relativeUrlPath: objectKey };
}