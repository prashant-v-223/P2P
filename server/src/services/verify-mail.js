if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const { verifyMailTransport } = await import('./mail.service.js');
await verifyMailTransport();
console.log('[MAIL] SMTP connection and authentication verified.');
