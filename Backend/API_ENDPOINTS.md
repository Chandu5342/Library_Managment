# API endpoints

Base URL: `/api/v1`. Unless marked **Public**, requests require `Authorization: Bearer <accessToken>`. Staff means `ADMIN`, `LIBRARIAN`, or `ASSISTANT_LIBRARIAN`. All responses use `{ success, message, data, meta }`; errors use `{ success: false, message, errors }`. Paginated lists return `page`, `limit`, `total`, and `totalPages` in `meta` (default page 1, limit 20; max limit 100).

## Auth

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `POST /auth/register` | Public | `{ name, email, password, phone?, registerNumber? }` (password 8+ chars) | `{ user, token, accessToken, refreshToken }` |
| `POST /auth/login` | Public; rate-limited | `{ email, password }` | `{ user, token, accessToken, refreshToken, passwordChangeRequired }` |
| `POST /auth/refresh` | Public; rate-limited | `{ refreshToken }` | Rotated `{ user, token, accessToken, refreshToken }` |
| `POST /auth/logout` | Any signed-in role | No body | `{}` |
| `PUT /auth/change-password` | Any signed-in role; allowed with a temporary password | `{ currentPassword, newPassword }` (new password 8+ chars) | Updated public user |
| `GET /auth/me` | Any signed-in role | — | Public user profile |

## Users

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /users` | ADMIN | `page`, `limit`, `role`, `search` | User page |
| `PATCH /users/:id` | ADMIN | `{ name?, phone?, profileImage?, isActive?, role?, password? }` | User |
| `PATCH /users/me/profile` | Any signed-in role | `{ name?, phone?, profileImage?, password? }` | User |

## Students

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /students` | Staff | `page`, `limit`, `search`, `rfid`, `registerNumber`, `name`, `department`, `branch`, `year`, `section`, `status` | Student page with UI aliases and live counts |
| `GET /students/search` | Staff | Same filters as list | Student page |
| `GET /students/rfid/:rfid` | Staff | RFID in path | Student and current books |
| `GET /students/me` | STUDENT | — | Own student profile and current books |
| `GET /students/:id` | Staff or the matching STUDENT | — | Student |
| `POST /students` | ADMIN, LIBRARIAN, ASSISTANT_LIBRARIAN | Member profile fields (registration number for Student/Faculty, `libraryId` for Librarian/Staff) | Creates linked User + member profile; returns generated login email and temporary password once |
| `PUT /students/:id` | ADMIN, LIBRARIAN, ASSISTANT_LIBRARIAN | Student fields to update | Student |
| `DELETE /students/:id` | ADMIN, LIBRARIAN | — | Deactivated student |
| `GET /students/:id/history` | Staff or the matching STUDENT | `page`, `limit` | Circulation page |
| `GET /students/:id/current-books` | Staff or the matching STUDENT | — | Current physical copies |
| `GET /students/:id/fines` | Staff or the matching STUDENT | `page`, `limit` | Fine page |
| `GET /students/:id/reservations` | Staff or the matching STUDENT | `page`, `limit` | Reservation page |

## Books

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /books` | Any signed-in role | `page`, `limit`, `search`, `title`, `author`, `category`, `subcategory`, `department`, `isbn`, `rfid`, `copyId` | Copy-level catalog page with title/copy aliases |
| `GET /books/search` | Any signed-in role | Same search/filter parameters | Copy-level catalog page |
| `GET /books/:id` | Any signed-in role | Title ObjectId or copy ID | Title with representative copy aliases |
| `POST /books` | Staff | Bibliographic fields and optional `quantity`, `rfidUid`/`rfidId`, location, condition, price | Created title and first copy |
| `PUT /books/:id` | Staff | Title/copy fields | Updated title/copy |
| `DELETE /books/:id` | ADMIN, LIBRARIAN | Title ObjectId or copy ID | Soft-archived resource |
| `GET /books/:id/copies` | Any signed-in role | — | Physical copies |
| `GET /books/:id/availability` | Any signed-in role | — | Title and copy counts |
| `GET /books/:id/holder` | Any signed-in role | — | Current circulation holder or `null` |
| `GET /books/:id/history` | Any signed-in role | `page`, `limit` | Circulation page |

## Book Copies

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /book-copies` | Any signed-in role | `page`, `limit`, `search`, `status`, `bookTitleId`, `rfid` | Copy page with title, holder, circulation |
| `GET /book-copies/:id` | Any signed-in role | Copy ObjectId or `copyId` | Copy and linked details |
| `GET /book-copies/rfid/:rfid` | Any signed-in role | RFID in path | Copy, title, status, condition, holder, reservation |
| `POST /book-copies` | Staff | `{ bookTitleId, rfidUid?, copyId?, accessionNumber?, location?, condition? }` | Created copy |
| `PUT /book-copies/:id` | Staff | Copy fields | Updated copy |
| `PATCH /book-copies/:id/status` | Staff | `{ status }` | Updated copy; issued/reserved changes must use workflows |
| `PATCH /book-copies/:id/condition` | Staff | `{ condition }` | Updated copy |
| `DELETE /book-copies/:id` | ADMIN, LIBRARIAN | — | Soft-archived copy |

## RFID

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /rfid/book/:rfid` | Any signed-in role | RFID in path | Physical book copy details |
| `GET /rfid/student/:rfid` | Any signed-in role | RFID in path | Student details |
| `GET /rfid/:rfid` | Any signed-in role | RFID in path | `{ type: BOOK_COPY|STUDENT, copy|student }` |
| `POST /rfid/generate` | Staff | — | `{ rfidUid }` unique candidate; copy creation assigns generated UIDs automatically |
| `POST /rfid/validate` | Any signed-in role | `{ rfid }` | `{ valid, registered, type }` |
| `POST /rfid/register` | Staff | `{ type: BOOK_COPY|STUDENT, id, rfid }` | Updated entity |
| `GET /rfid/logs` | Staff | `page`, `limit`, `entityType` | RFID scan page |
| `GET /rfid/devices` | Staff | — | Registered devices or simulation reader |

## Circulation

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /circulation` | Staff | `page`, `limit`, `search`, `status`, `studentId`, `bookCopyId`, `from`, `to`, `sort` | Circulation page |
| `GET /circulation/active` | Staff | `page`, `limit` | Active loans |
| `GET /circulation/history` | Staff | `page`, `limit` | Returned loans |
| `GET /circulation/overdue` | Staff | `page`, `limit` | Active loans past due |
| `GET /circulation/:id` | Any signed-in role | — | Circulation with student/book/fine |
| `GET /circulation/student/:studentId` | Staff or matching STUDENT | `page`, `limit`, `status` | Student circulation page |
| `GET /circulation/book/:bookCopyId` | Staff | `page`, `limit` | Copy circulation page |
| `POST /circulation/validate-issue` | Staff | `{ studentId, bookCopyId, bookRfid }` | Eligibility, book, student and due-date preview |
| `POST /circulation/issue` | Staff | `{ studentId, bookCopyId, bookRfid }` | Circulation, student, title, copy |
| `POST /circulation/return` | Staff | `{ studentId, bookRfid, conditionAtReturn? }` | Circulation, book, student, overdue days, fine and next reservation |
| `POST /circulation/:id/renew` | Staff or linked STUDENT | — | Renewed circulation and new due date |

## Reservations

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /reservations` | Staff | `page`, `limit`, `status`, `studentId`, `bookTitleId` | Reservation page |
| `GET /reservations/:id` | Staff | — | Reservation |
| `GET /reservations/book/:bookTitleId` | Staff | `page`, `limit` | Title reservation queue |
| `GET /reservations/student/:studentId` | Staff or matching STUDENT | `page`, `limit` | Student reservations |
| `POST /reservations` | Any signed-in role | `{ bookTitleId, studentId? , notes? }`; STUDENT is bound to own profile | Queued reservation |
| `POST /reservations/:id/cancel` | Staff or owner STUDENT | — | Cancelled reservation |
| `POST /reservations/:id/approve` | Staff | — | Moves the next queue entry to ready-for-pickup and assigns an available copy |
| `POST /reservations/:id/fulfill` | Staff | — | Issues reserved copy to reservation owner |
| `POST /reservations/:id/expire` | ADMIN, LIBRARIAN | — | Expired reservation and advanced queue when possible |

## Fines

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /fines` | Staff | `page`, `limit`, `status`, `studentId` | Fine page |
| `GET /fines/:id` | Any signed-in role | — | Fine |
| `GET /fines/student/:studentId` | Staff | `page`, `limit` | Student fine page |
| `POST /fines/:id/pay` | Staff or owning STUDENT | `{ amount, paymentMethod?, paymentReference? }` | Updated fine/payment history |
| `POST /fines/:id/waive` | ADMIN, LIBRARIAN | `{ reason }` | Waived fine |
| `POST /fines/:id/reverse-payment` | ADMIN, LIBRARIAN | `{ paymentId, reason }` | Updated fine/payment history |

## Suppliers

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /suppliers` | Staff | `page`, `limit`, `search` | Supplier page |
| `GET /suppliers/:id` | Staff | — | Supplier |
| `POST /suppliers` | Staff | `{ supplierName, contactPerson?, email?, phone?, address?, city?, state?, country?, notes? }` | Supplier |
| `PUT /suppliers/:id` | Staff | Supplier fields | Updated supplier |
| `DELETE /suppliers/:id` | ADMIN, LIBRARIAN | — | Deactivated supplier; historical suppliers with acquisitions are retained |

## Acquisitions

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /acquisitions` | Staff | `page`, `limit`, `status`, `supplierId` | Acquisition page |
| `GET /acquisitions/:id` | Staff | — | Acquisition |
| `POST /acquisitions` | Staff | `{ supplierId?, expectedDate?, items:[{ title, authors?, isbn?, category?, subcategory?, department?, edition?, publicationYear?, quantityOrdered, unitCost }] }` | Acquisition |
| `PUT /acquisitions/:id` | Staff | Editable acquisition fields/items | Updated acquisition |
| `DELETE /acquisitions/:id` | Staff | — | Cancelled acquisition |
| `POST /acquisitions/:id/receive` | Staff | `{ items?: [{ itemId, quantity }] }` (omitted means receive remaining balance) | Updated acquisition; physical copies/RFIDs created |

## Inventory

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /inventory/summary` | Staff | — | Copy-derived stock counts |
| `GET /inventory/books` | Staff | `page`, `limit`, `status`, `location`, `bookTitleId` | Copy page |
| `GET /inventory/book/:bookTitleId` | Staff | — | Title and copies |
| `GET /inventory/copy/:copyId` | Staff | — | Copy details |
| `PATCH /inventory/copy/:copyId/status` | Staff | `{ status }` | Updated copy and title counts |
| `PATCH /inventory/copy/:copyId/condition` | Staff | `{ condition }` | Updated copy and title counts |
| `GET /inventory/audits` | Staff | `page`, `limit`, `status` | Inventory-audit page |
| `POST /inventory/audits` | Staff | `{ location?, department? }` | Started audit |
| `POST /inventory/audits/:id/scan` | Staff | `{ rfid }` | Audit, scanned copy and discrepancy flags |
| `POST /inventory/audits/:id/complete` | Staff | — | Completed audit and missing-copy list |

## Notifications

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /notifications` | Any signed-in role; own records only (ADMIN may filter `userId`) | `page`, `limit`, `isRead` | Notification page |
| `PATCH /notifications/:id/read` | Any signed-in role; own record only | — | Updated notification |
| `PATCH /notifications/read-all` | Any signed-in role | — | Update result |
| `DELETE /notifications/:id` | Any signed-in role; own record only | — | `{}` |

## Reports

Each report supports `page`, `limit`, `from`, `to`, `department`, `category`, `status`, and `search` where applicable.

| Method and URL | Authentication / role | Response data |
|---|---|---|
| `GET /reports/books` | Staff | Book report page |
| `GET /reports/students` | Staff | Student report page |
| `GET /reports/circulation` | Staff | Circulation report page |
| `GET /reports/overdue` | Staff | Overdue circulation page |
| `GET /reports/fines` | Staff | Fine report page |
| `GET /reports/reservations` | Staff | Reservation report page |
| `GET /reports/inventory` | Staff | Copy inventory report page |
| `GET /reports/acquisitions` | Staff | Acquisition report page |

## Analytics and dashboard

| Method and URL | Authentication / role | Query | Response data |
|---|---|---|---|
| `GET /dashboard/summary` | Staff | — | Current dashboard totals |
| `GET /analytics/overview` | Staff | — | Summary and analytics widgets |
| `GET /analytics/most-borrowed-books` | Staff | `limit` | Aggregated title ranking |
| `GET /analytics/most-borrowed-categories` | Staff | `limit` | Aggregated category ranking |
| `GET /analytics/most-active-students` | Staff | `limit` | Aggregated student ranking |
| `GET /analytics/department-usage` | Staff | — | Aggregated department usage |
| `GET /analytics/circulation-trends` | Staff | `days` (1–365) | Daily issue/return trend |
| `GET /analytics/overdue-trends` | Staff | `days` (1–365) | Daily due/overdue trend |
| `GET /analytics/reservation-demand` | Staff | — | Title reservation demand |

## Settings

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /settings` | ADMIN, LIBRARIAN | — | Library settings plus UI aliases |
| `PUT /settings` | ADMIN, LIBRARIAN | Settings fields including loan period, book/reservation limits, fine rate, pickup window, renewals, and working hours | Updated settings |

## Audit logs

| Method and URL | Authentication / role | Request | Response data |
|---|---|---|---|
| `GET /audit-logs` | Staff | `page`, `limit`, `user`, `action`, `entity`, `from`, `to` | Audit page |
| `GET /audit-logs/:id` | Staff | — | Audit record |

## Health

| Method and URL | Authentication / role | Response data |
|---|---|---|
| `GET /health` | Public | `{ status: "ok" }` |
