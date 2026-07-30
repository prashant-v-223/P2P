import mongoose from 'mongoose';
import dns from 'node:dns';
import { seedDatabase } from './seed.js';

const DEFAULT_DATABASE_NAME = 'rayzon_p2p';
const DEFAULT_ATLAS_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

const configureAtlasDns = () => {
  const configuredServers = process.env.MONGODB_DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  const currentServers = dns.getServers();
  const isLoopbackOnly =
    currentServers.length > 0 &&
    currentServers.every((server) => server === '127.0.0.1' || server === '::1');

  if (configuredServers?.length) {
    dns.setServers(configuredServers);
    console.log('[DB] Using configured DNS resolvers for MongoDB Atlas.');
  } else if (isLoopbackOnly) {
    dns.setServers(DEFAULT_ATLAS_DNS_SERVERS);
    console.log('[DB] Local DNS blocks Atlas SRV; using public DNS resolvers.');
  }
};

const getMongoConfig = () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error('MONGODB_URI is missing from .env');
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  return {
    uri,
    databaseName: process.env.MONGODB_DB_NAME?.trim() || DEFAULT_DATABASE_NAME
  };
};

export const connectDB = async () => {
  try {
    const { uri, databaseName } = getMongoConfig();
    configureAtlasDns();
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true
    });

    console.log(`[DB] Connected to "${mongoose.connection.name}" on ${mongoose.connection.host}`);
    await seedDatabase();
    return true;
  } catch (error) {
    // Never log the URI because it can contain database credentials.
    console.error(`[DB] MongoDB Atlas connection failed: ${error.message}`);
    console.warn('[DB FALLBACK]: Using the resilient in-memory data store.');
    return false;
  }
};
