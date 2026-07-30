// Load environment values before importing modules that read process.env.
if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const [{ default: app }, { config }, { connectDB }, { startSapScheduler }] = await Promise.all([
  import('./src/app.js'),
  import('./src/config/index.js'),
  import('./src/db/index.js'),
  import('./src/modules/sap/sap.scheduler.js')
]);

const startServer = (portToTry) => {
  const server = app.listen(portToTry, '0.0.0.0', () => {
    console.log(`Rayzon P2P Enterprise Modular Server running on http://localhost:${portToTry}`);
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

startServer(Number(config.port) || 5000);

// Keep the API available while MongoDB connects or the fallback store activates.
void connectDB().then((connected) => {
  if (connected) startSapScheduler();
});
