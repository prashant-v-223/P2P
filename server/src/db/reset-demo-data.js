if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

import mongoose from 'mongoose';
import { connectDB } from './index.js';
import { seedDatabase } from './seed.js';

if (process.env.RESET_CONFIRM !== 'RESET_DEMO_DATA') {
  throw new Error('Set RESET_CONFIRM=RESET_DEMO_DATA before running this command.');
}

try {
  const connected = await connectDB({ seed: false });
  if (!connected) throw new Error('Database connection failed. Check MONGODB_URI in .env.');

  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }

  await seedDatabase();
  console.log('Demo database reset complete. User hierarchy and P2P sample records are ready.');
} finally {
  await mongoose.disconnect();
}
