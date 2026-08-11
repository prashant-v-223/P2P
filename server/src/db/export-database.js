import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { connectDB } from './index.js';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const backupRoot = path.resolve(process.cwd(), 'backups');
const exportDir = path.join(backupRoot, `rayzon_p2p-${stamp}`);

fs.mkdirSync(exportDir, { recursive: true });

const writeCollection = async (collection, targetFile) => {
  const documents = [];

  for await (const document of collection.find({})) {
    documents.push(document);
  }

  // Canonical Extended JSON
  const json = EJSON.stringify(
    documents,
    {
      relaxed: false,
      indent: 2,
    }
  );

  fs.writeFileSync(targetFile, `${json}\n`, {
    flag: 'wx',
  });

  return documents.length;
};

let exitCode = 0;

try {
  const connected = await connectDB({
    seed: false,
    ensureWorkflows: false,
  });

  if (!connected) {
    throw new Error(
      'MongoDB connection failed; no backup was created.'
    );
  }

  const database = mongoose.connection.db;

  const collections = (
    await database
      .listCollections({}, { nameOnly: true })
      .toArray()
  )
    .map(({ name }) => name)
    .filter((name) => !name.startsWith('system.'))
    .sort();

  const manifest = {
    format: 'MongoDB Extended JSON',
    database: mongoose.connection.name,
    createdAt: new Date().toISOString(),
    collections: [],
  };

  for (const name of collections) {
    const safeName = name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const fileName = `${safeName}.json`;
    const targetFile = path.join(exportDir, fileName);

    const count = await writeCollection(
      database.collection(name),
      targetFile
    );

    manifest.collections.push({
      name,
      file: fileName,
      documents: count,
    });

    console.log(
      `[BACKUP] ${name}: ${count} document(s)`
    );
  }

  manifest.totalCollections =
    manifest.collections.length;

  manifest.totalDocuments =
    manifest.collections.reduce(
      (sum, item) => sum + item.documents,
      0
    );

  fs.writeFileSync(
    path.join(exportDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {
      flag: 'wx',
    }
  );

  console.log(
    `[BACKUP] Complete: ${manifest.totalCollections} collections, ${manifest.totalDocuments} documents`
  );

  console.log(`EXPORT_DIR=${exportDir}`);
} catch (error) {
  exitCode = 1;

  console.error(
    `[BACKUP] Failed: ${error.message}`
  );
} finally {
  await mongoose.disconnect().catch(() => {});
  process.exitCode = exitCode;
}