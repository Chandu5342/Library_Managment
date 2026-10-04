# Library Management API

Express/Mongoose backend for the existing React library workspace. The frontend keeps its copy-level book records and legacy field aliases through the API adapter; persistence is normalized into book titles, physical copies, students, and circulation records.

## Architecture

`Express route -> request validators -> controller -> service -> Mongoose model -> MongoDB`

- `src/routes` declares endpoint wiring and role gates.
- `src/controllers` translates requests to service calls and formats API responses.
- `src/services` owns business rules, queries, transactions, notifications, and audit events.
- `src/models` defines indexed MongoDB collections.
- `src/middleware` provides JWT authentication, role authorization, request logging, and centralized errors.

The main records are `BookTitle` (bibliographic record) and `BookCopy` (one physical item/RFID). `Circulation` is the permanent issue/return history. Student borrowing counts and book availability counters are maintained in the same transactions that update copies and circulation; inventory summary endpoints derive their totals from active copies.

## Requirements and setup

- Node.js 20 or newer
- MongoDB 6.0 or newer

From this directory:

```sh
npm install
Copy-Item .env.example .env
```

Set `MONGODB_URI` and a unique `JWT_SECRET` in `.env`. In production, use a secret of at least 32 characters and set an explicit `CORS_ORIGIN`. Never commit `.env`.

New members created by staff receive a linked login account and must change their temporary password on first login. Development defaults to `INITIAL_MEMBER_PASSWORD=126`; set a strong one-time value explicitly in production.

The default local connection selects the `library_management` database and works with a normal standalone MongoDB service. On standalone MongoDB, multi-document workflows run without transaction guarantees and the API logs a warning at startup. A replica set or sharded cluster enables transaction guarantees.

```sh
npm run dev
npm start
npm run seed
npm run lint
```

`npm run seed` is development-only and idempotently ensures the ten requested titles/copies, four linked student accounts, and administrator/librarian accounts. It does not delete records. Each seeded account initially uses password `126` and must change it on first login. Accounts: `admin@gmail.com`, `lib001@gmail.com`, `23l31a0414@gmail.com`, `23l31a0450@gmail.com`, `24l35a0403@gmail.com`, and `23l31a0449@gmail.com`.

The frontend can connect by setting `VITE_API_BASE_URL=http://localhost:5000/api/v1` in `Frontend/.env.local`. The API client defaults to that local URL.

The development seed migrates the earlier `admin@northbridge.edu`, `librarian@northbridge.edu`, and linked student demo login to the documented addresses where those legacy seed accounts exist. It preserves existing circulation data and physical copy status.

## Authentication and roles

Login returns an access JWT in both `data.token` and `data.accessToken`, a rotating refresh token, and the public user. Send `Authorization: Bearer <accessToken>` for protected routes. Access tokens contain `userId` and `role`; middleware verifies the token and reloads an active user for every request.

`POST /auth/refresh` rotates the refresh token. `POST /auth/logout` revokes the stored refresh-token hash. Staff roles are `ADMIN`, `LIBRARIAN`, and `ASSISTANT_LIBRARIAN`; sensitive operations are protected server-side. Faculty and student accounts have catalog/self-service access; student-specific history and notifications are scoped to the signed-in user.

## Response format

Success:

```json
{ "success": true, "message": "Books retrieved successfully.", "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

Single-record responses use an empty `meta` object. Errors are returned as `{ "success": false, "message": "...", "errors": [] }` with HTTP status codes `400`, `401`, `403`, `404`, `409`, or `500`. Database internals are not exposed. Lists accept `page` and `limit` (default 1 and 20, maximum 100).

## Important business rules

- RFID values are normalized to uppercase without separators for storage and lookup. The frontend may show UIDs formatted with spaces.
- The backend checks RFID uniqueness across both students and physical book copies.
- A title can have many physical copies; circulation always points to a specific `BookCopy`.
- Issue and return enforce member status, configured borrowing limits, copy state, current holder, RFID match, reservation priority, active loans, and configured overdue/fine blocks.
- Returning a copy computes overdue days from the actual due/return calendar dates and uses the current `dailyFineAmount`.
- Reservations queue by title. A newly free copy becomes `RESERVED` for the next pending student and a pickup expiry is calculated from settings. An expired ready reservation can be expired through its endpoint, which advances the queue.
- Acquisition receipts create a physical copy for every unit received and assign a unique server-generated RFID.
- Students, titles, copies, and suppliers are deactivated instead of erasing records referenced by history. Audit logs are append-only.
- Multi-record workflows use MongoDB transactions when the connected deployment supports them. Standalone MongoDB is supported for simple local setup, but those workflows are not atomic and the server logs this limitation at startup.

## RFID and circulation flow

The reader is an input device only; the API resolves a submitted UID against `BookCopy` or `Student`. Student identification uses `GET /students/rfid/:rfid`; book identification uses `GET /book-copies/rfid/:rfid` or `/rfid/book/:rfid`. These responses include the book title/copy, condition, status, holder and reservation context.

Issue posts `studentId`, `bookCopyId`, and `bookRfid` to `/circulation/issue`. Return posts the selected `studentId` and scanned `bookRfid` to `/circulation/return`. Both operations repeat validation in the backend and update circulation, copy, title, student, fine (if applicable), notification, reservation queue, and audit state in a MongoDB transaction when supported by the deployment.

## Notes and scope

The API includes UI support for reservation fulfillment/expiry, renewals, inventory audits, RFID logs/devices, reports, analytics, settings, and audit events. A real RFID reader integration is intentionally not vendor-specific. Payment processing is a library ledger operation, not a card-payment gateway.
