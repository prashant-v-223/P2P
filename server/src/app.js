import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './modules/auth/auth.router.js';
import usersRouter from './modules/users/users.router.js';
import rolesRouter from './modules/roles/roles.router.js';
import workflowsRouter from './modules/workflows/workflows.router.js';
import exchangeRatesRouter from './modules/exchangeRates/exchangeRates.router.js';
import approvalsRouter from './modules/approvals/approvals.router.js';
import vendorsRouter from './modules/vendors/vendors.router.js';
import suppliersRouter from './modules/suppliers/suppliers.router.js';
import customAgentsRouter from './modules/customAgents/customAgents.router.js';
import p2pRouter from './modules/p2p/p2pRoutes.js';
import eventsRouter from './modules/events/events.router.js';
import documentsRouter from './modules/documents/documents.router.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'uploads')));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Modular Router Middleware Mapping
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/exchange-rates', exchangeRatesRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/vendor', vendorsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/custom-agents', customAgentsRouter);
app.use('/api/p2p', p2pRouter);
app.use('/api/events', eventsRouter);
app.use('/api/documents', documentsRouter); // Document upload/download routes

// Fallback 200 OK Handler for any unhandled /api path
app.all('/api/*', (req, res) => {
  res.status(200).json({ success: true, message: 'API active' });
});

export default app;
