import express from 'express';
import cors from 'cors';
import authRouter from './modules/auth/auth.router.js';
import usersRouter from './modules/users/users.router.js';
import rolesRouter from './modules/roles/roles.router.js';
import workflowsRouter from './modules/workflows/workflows.router.js';
import exchangeRatesRouter from './modules/exchangeRates/exchangeRates.router.js';
import approvalsRouter from './modules/approvals/approvals.router.js';
import vendorsRouter from './modules/vendors/vendors.router.js';
import suppliersRouter from './modules/suppliers/suppliers.router.js';

const app = express();

app.use(cors());
app.use(express.json());

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
app.use('/api/suppliers', suppliersRouter);

// Fallback 200 OK Handler for any unhandled /api path
app.all('/api/*', (req, res) => {
  res.status(200).json({ success: true, message: 'API active' });
});

export default app;
