import mongoose from 'mongoose';
import dns from 'node:dns';
import { seedDatabase } from './seed.js';
import { ensureAllWorkflows } from '../modules/workflows/workflowDefaults.js';
import { repairAllActiveApprovals } from '../services/approvalRouting.service.js';

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

export const connectDB = async ({ seed = process.env.AUTO_SEED === 'true', ensureWorkflows = false } = {}) => {
  try {
    const { uri, databaseName } = getMongoConfig();
    if (uri.includes('mongodb+srv://')) {
      configureAtlasDns();
    }
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2
    });

    mongoose.set('bufferCommands', true);
    console.log(`[DB] Connected to "${mongoose.connection.name}" on ${mongoose.connection.host}`);
    if (ensureWorkflows) await ensureAllWorkflows().catch((err) => console.warn('[DB WORKFLOW SEED WARN]', err.message));
    if (seed) await seedDatabase();

    // Auto-repair active approval workflow and old payment records in background
    void repairAllActiveApprovals()
      .then(() => import('../services/approvalRouting.service.js'))
      .then(({ repairAllOldPaymentRecords }) => repairAllOldPaymentRecords())
      .catch((err) => console.warn('[DB APPROVAL REPAIR WARN]', err.message));
    return true;
  } catch (error) {
    mongoose.set('bufferCommands', false);
    console.error(`[DB] Database connection failed: ${error.message}`);
    console.warn('[DB WARNING]: MongoDB Atlas connection unavailable. Critical financial transactions and approvals will be rejected safely until DB restores.');
    return false;
  }
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

