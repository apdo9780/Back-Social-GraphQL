import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  // Use 127.0.0.1 by default to avoid IPv6 localhost (::1) connection issues.
  const uri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/socialapp';
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error: ${error?.message || String(error)}`);
    process.exit(1);
  }
}

