if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const mongoose = (await import('mongoose')).default;
const [{ default: app }, { connectDB }] = await Promise.all([
  import('../app.js'),
  import('./index.js')
]);

const connected = await connectDB();
if (!connected) process.exit(1);

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const body = await response.json();
  return { response, body };
};

try {
  const invalidLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@rayzon.one', password: 'incorrect-password' })
  });
  if (invalidLogin.response.status !== 401) throw new Error('Invalid-password login was not rejected.');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@rayzon.one', password: 'password123' })
  });
  if (!login.response.ok || !login.body.accessToken) throw new Error('Seeded admin login failed.');
  if ('passwordHash' in login.body.user) throw new Error('Password hash leaked through the API.');

  const authorization = { Authorization: `Bearer ${login.body.accessToken}` };
  const [users, roles, permissions, workflows, rates, approvals] = await Promise.all([
    request('/api/users', { headers: authorization }),
    request('/api/roles', { headers: authorization }),
    request('/api/permissions', { headers: authorization }),
    request('/api/workflows'),
    request('/api/exchange-rates'),
    request('/api/approvals/pending')
  ]);

  for (const result of [users, roles, permissions, workflows, rates, approvals]) {
    if (!result.response.ok) throw new Error(`API check failed with ${result.response.status}.`);
  }

  const suffix = Date.now();
  const createdPermission = await request('/api/permissions', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({
      key: `smoke-${suffix}.read`,
      name: 'Smoke Test Read',
      module: 'Smoke Test',
      description: 'Temporary permission created by the backend smoke test.'
    })
  });
  if (createdPermission.response.status !== 201) throw new Error(`Permission creation failed: ${createdPermission.body.error}`);

  const createdRole = await request('/api/roles', {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({
      roleName: `Smoke Test Role ${suffix}`,
      description: 'Temporary role created by the backend smoke test.',
      permissions: { [`smoke-${suffix}`]: ['read'] }
    })
  });
  if (createdRole.response.status !== 201) throw new Error(`Role creation failed: ${createdRole.body.error}`);

  const updatedRole = await request(`/api/roles/${createdRole.body.role.id}`, {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ description: 'Updated smoke-test role.' })
  });
  if (!updatedRole.response.ok) throw new Error(`Role update failed: ${updatedRole.body.error}`);

  const deletedRole = await request(`/api/roles/${createdRole.body.role.id}`, { method: 'DELETE', headers: authorization });
  const deletedPermission = await request(`/api/permissions/${createdPermission.body.permission.id}`, { method: 'DELETE', headers: authorization });
  if (!deletedRole.response.ok || !deletedPermission.response.ok) throw new Error('Temporary RBAC test records were not deleted.');

  console.log('[BACKEND TEST] Authentication, RBAC, collection reads, and role/permission CRUD passed.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}
