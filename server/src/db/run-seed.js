if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const mongoose = (await import('mongoose')).default;
const { connectDB } = await import('./index.js');

const connected = await connectDB();
await mongoose.disconnect();
process.exit(connected ? 0 : 1);
