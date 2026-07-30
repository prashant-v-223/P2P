# Rayzon P2P API Guide

This document describes the API currently implemented in `server/src`. The default local base URL is:

```text
http://localhost:5001/api
```

## Start and verify the API

```powershell
npm run server
```

Check server health:

```http
GET /api/health
```

Successful response:

```json
{
  "success": true,
  "status": "Rayzon P2P Enterprise Engine Operational"
}
```

Useful project commands:

```powershell
npm run seed
npm run test:backend
npm run test:mail
npm run dev:all
```

## Request conventions

- Send JSON with `Content-Type: application/json`.
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- Access tokens expire after 15 minutes.
- Refresh tokens expire after 7 days and are rotated when refreshed.
- Successful responses normally contain `success: true`.
- Failed responses normally contain `success: false` and an `error` message.

Example protected request:

```bash
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Authentication flow

1. Call `POST /auth/login`.
2. If the response contains `requiresTwoFactor: true`, collect the emailed six-digit code and call `/auth/login` again with the same email/password plus `twoFactorCode`.
3. Store the returned access and refresh tokens securely.
4. Send the access token in the Bearer header for protected requests.
5. On a `401` response with `code: "TOKEN_EXPIRED"`, call `POST /auth/refresh`.
6. Replace both stored tokens with the newly returned tokens.
7. Call `POST /auth/logout` when signing out.

### Register

```http
POST /api/auth/register
```

```json
{
  "name": "Ramesh Patel",
  "email": "ramesh@rayzon.one",
  "password": "StrongPassword123",
  "department": "Procurement",
  "role": "Procurement Head"
}
```

Required: `name`, `email`, `password` (minimum 8 characters). Returns status `201` with `user`, `accessToken`, and `refreshToken`.

### Login

```http
POST /api/auth/login
```

```json
{
  "email": "admin@rayzon.one",
  "password": "password123"
}
```

Two-factor continuation:

```json
{
  "email": "admin@rayzon.one",
  "password": "password123",
  "twoFactorCode": "123456"
}
```

### Refresh tokens

```http
POST /api/auth/refresh
```

```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN"
}
```

### Forgot and reset password

```http
POST /api/auth/forgot-password
```

```json
{
  "email": "name@rayzon.one"
}
```

The response is intentionally generic when an account does not exist. In non-production mode it may also include `otpCode`.

```http
POST /api/auth/reset-password
```

```json
{
  "email": "name@rayzon.one",
  "otpCode": "123456",
  "newPassword": "NewPassword123"
}
```

### Current account

| Method | Endpoint | Protected | Purpose |
|---|---|---:|---|
| GET | `/auth/me` | Yes | Get the signed-in user |
| PUT | `/auth/me` | Yes | Update `name`, `email`, or `department` |
| PUT | `/auth/change-password` | Yes | Change password and revoke other sessions |
| PUT | `/auth/two-factor` | Yes | Enable or disable email two-factor authentication |
| POST | `/auth/revoke-all-sessions` | Yes | Revoke all stored refresh tokens |
| POST | `/auth/logout` | Yes | Revoke the supplied refresh token |

Update profile:

```json
{
  "name": "System Admin",
  "email": "admin@rayzon.one",
  "department": "IT Operations"
}
```

Change password:

```json
{
  "currentPassword": "CurrentPassword",
  "newPassword": "NewPassword123"
}
```

Update two-factor:

```json
{
  "enabled": true,
  "currentPassword": "CurrentPassword"
}
```

Logout:

```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN"
}
```

## Users

All user endpoints require authentication plus the corresponding `users` permission.

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/users` | `users.read` | List users |
| POST | `/users` | `users.create` | Create a user |
| PUT | `/users/:id` | `users.edit` | Update a user |
| DELETE | `/users/:id` | `users.delete` | Delete a user |

Create user:

```json
{
  "name": "Finance User",
  "email": "finance@rayzon.one",
  "password": "Temporary123",
  "role": "Finance Lead",
  "department": "Finance & Accounts"
}
```

Update user (send only changed fields):

```json
{
  "role": "Procurement Head",
  "department": "Procurement",
  "status": "Active"
}
```

## Roles

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/roles` | Authenticated | List roles and user counts |
| POST | `/roles` | System Admin | Create a custom role |
| PUT | `/roles/:id` | System Admin | Update role name, description, or status |
| PUT | `/roles/:id/permissions` | System Admin | Replace a role's permissions |
| DELETE | `/roles/:id` | System Admin | Delete an unused custom role |

Create role:

```json
{
  "roleName": "Treasury Manager",
  "description": "Manages treasury rates and payment clearance.",
  "status": "Active",
  "permissions": {
    "exchangeRates": ["read", "update"],
    "approvals": ["read", "approve"]
  }
}
```

Example permissions object:

```json
{
  "permissions": {
    "users": ["read", "create"],
    "workflows": ["read", "create", "edit"],
    "exchangeRates": ["read"]
  }
}
```

System Admin bypasses permission checks. Other roles are checked against their stored module/action permissions.

System roles cannot be deleted. A custom role also cannot be deleted while users are assigned to it.

## Permissions

Permissions are normalized MongoDB records using a `module.action` key. Role assignments remain stored as a module-to-actions object for fast middleware checks.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/permissions` | Authenticated | List permission records with role usage counts |
| POST | `/permissions` | System Admin | Create a custom permission |
| PUT | `/permissions/:id` | System Admin | Update a permission |
| DELETE | `/permissions/:id` | System Admin | Delete a custom permission and remove its assignments |

Create permission:

```json
{
  "key": "vendors.approve",
  "name": "Approve vendors",
  "module": "Vendor Management",
  "description": "Allows approval of verified vendor records.",
  "status": "Active"
}
```

Permission keys must use lowercase `module.action` format. Updating a key migrates existing role assignments. Deleting a custom permission removes it from every assigned role. Seeded system permissions cannot be deleted.

## Workflows

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/workflows` | Public currently | List workflow slabs |
| POST | `/workflows` | `workflows.create` | Create a slab |
| PUT | `/workflows/:id` | `workflows.edit` | Update a slab |
| DELETE | `/workflows/:id` | `workflows.delete` | Delete a slab |

Create workflow:

```json
{
  "category": "Advance Payment",
  "name": "Advance Payment Above 1 Crore",
  "minAmount": 10000000,
  "maxAmount": null,
  "description": "Executive approval for high-value advances.",
  "steps": [
    {
      "step": 1,
      "title": "Procurement Head Approval",
      "roleKey": "procurement_head"
    },
    {
      "step": 2,
      "title": "Finance Approval",
      "roleKey": "finance"
    }
  ]
}
```

`maxAmount` may be `null` for no upper limit. The server generates `id` and `formattedRange`.

## Exchange rates

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/exchange-rates` | Public currently | List rates |
| PUT | `/exchange-rates` | `exchangeRates.edit` | Save multiple rates |
| POST | `/exchange-rates` | `exchangeRates.create` | Add a currency |
| DELETE | `/exchange-rates/:currency` | `exchangeRates.delete` | Delete by currency code |

Add currency:

```json
{
  "currency": "JPY",
  "name": "Japanese Yen",
  "rate": 0.55
}
```

Bulk save:

```json
{
  "rates": [
    {
      "currency": "USD",
      "name": "US Dollar",
      "rate": 83.25
    },
    {
      "currency": "EUR",
      "name": "Euro",
      "rate": 90.4
    }
  ]
}
```

Every rate must be a positive number. Currency codes are normalized to uppercase.

## Approvals

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/approvals/pending` | Public currently | List pending approvals |
| POST | `/approvals/:id/action` | Authenticated | Approve or reject a request |

Approval action:

```json
{
  "action": "approve",
  "remarks": "Documents and amount verified."
}
```

`action` must be `approve` or `reject`.

## Status codes

| Code | Meaning |
|---:|---|
| 200 | Request completed |
| 201 | Resource created |
| 202 | Login requires two-factor verification |
| 400 | Invalid or missing input |
| 401 | Missing, invalid, or expired access token |
| 403 | Valid user without the required role/permission |
| 404 | Resource not found |
| 409 | Duplicate email, user, or currency |
| 500 | Unexpected server error |

## Frontend integration pattern

Use the shared API client in `src/services/api.js`. It attaches the access token and handles the application's standard JSON workflow.

Recommended action flow:

1. Validate fields in the UI.
2. Disable the submit button while saving.
3. Send the request through `apiFetch`.
4. Parse the JSON response.
5. If `response.ok` is false, display `data.error`.
6. Update Redux state or refetch the affected collection.
7. Show the custom success/error toast.

## Security and production checklist

- Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; do not use the development defaults.
- Keep MongoDB, SMTP, and object-storage credentials only in `.env`.
- Never commit `.env` or return credentials in an API response.
- Restrict CORS to the deployed frontend origin.
- Add rate limiting to login, password reset, and two-factor endpoints.
- Move refresh-token storage from the in-memory `Map` to a persistent store for multi-instance deployments.
- Consider protecting the currently public workflow, exchange-rate, and pending-approval GET endpoints.
- Use HTTPS in production.
# SAP S/4HANA integration

All SAP routes require a valid bearer access token. SAP credentials are read only by the server from `.env`; they are never returned by the API or stored in MongoDB.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/sap/overview` | Connection state, public endpoint configuration, MongoDB record counts |
| `GET` | `/api/sap/history?page=1&size=10` | Paginated persisted sync history |
| `POST` | `/api/sap/sync/purchase-orders` | Full purchase-order sync |
| `POST` | `/api/sap/sync/purchase-orders` with `{ "poNumbers": ["4500001234"] }` | Pull selected missing POs |
| `POST` | `/api/sap/sync/suppliers` | Full supplier-master sync |

Required environment values:

```env
SAP_BASE_URL=https://my420266-api.s4hana.cloud.sap
SAP_USERNAME=
SAP_PASSWORD=
```

Optional hourly synchronization:

```env
SAP_SYNC_ENABLED=true
SAP_SYNC_INTERVAL_MINUTES=60
```

Purchase orders are upserted by `poNumber`, suppliers by `supplierId`, and every run is recorded in the `SapSyncRun` collection.
