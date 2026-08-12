import fs from 'fs';
import path from 'path';

// Load environment values before importing modules that read process.env.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // Fallback if .env is missing or invalid
  }
}

// Fallback .env file loader for Node environments without process.loadEnvFile
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const k = key.trim();
        const v = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) {
          process.env[k] = v;
        }
      }
    });
  } catch (e) {
    console.warn('[ENV] Failed to parse .env file:', e.message);
  }
}

const [{ default: app }, { config }, { connectDB }, { startSapScheduler }] = await Promise.all([
  import('./src/app.js'),
  import('./src/config/index.js'),
  import('./src/db/index.js'),
  import('./src/modules/sap/sap.scheduler.js')
]);

const startServer = (portToTry) => {
  const server = app.listen(portToTry, '0.0.0.0', () => {
    console.log(`Rayzon P2P Enterprise Modular Server running on http://0.0.0.0:${portToTry}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[PORT CONFLICT] Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(Number(config.port) || 5050);

// Keep the API available while MongoDB connects or the fallback store activates.
void connectDB().then((connected) => {
  if (connected) startSapScheduler();
});

