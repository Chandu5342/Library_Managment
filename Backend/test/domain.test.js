import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRfid, normalizeRfid, validateRfid } from '../src/services/rfidService.js'
import { addDays, overdueDays } from '../src/utils/dateUtils.js'
import { getPagination, paginationMeta } from '../src/utils/pagination.js'
import { calculateFine } from '../src/services/fineService.js'
import BookCopy from '../src/models/BookCopy.js'
import Student from '../src/models/Student.js'
import Reservation from '../src/models/Reservation.js'
import Notification from '../src/models/Notification.js'

test('RFID normalization supports formatted UIDs without changing their identity', () => {
  assert.equal(normalizeRfid('60 C0 3E 3B'), '60C03E3B')
  assert.equal(formatRfid('60c03e3b'), '60 C0 3E 3B')
  assert.equal(validateRfid('60 C0 3E 3B'), true)
  assert.equal(validateRfid('not-an-rfid'), false)
})

test('RFID models store formatted scanner input in canonical form', () => {
  const copy = new BookCopy({ copyId: 'TEST-COPY', bookTitleId: '507f1f77bcf86cd799439011', rfidUid: '60 C0 3E 3B' })
  const student = new Student({ studentId: 'TEST-STUDENT', registerNumber: 'TEST-STUDENT', name: 'Test Student', rfidUid: '60-C0-3E-3B' })
  assert.equal(copy.rfidUid, '60C03E3B')
  assert.equal(student.rfidUid, '60C03E3B')
})

test('overdue calculation counts calendar days and ignores same-day returns', () => {
  const dueDate = new Date('2026-10-01T15:00:00.000Z')
  assert.equal(overdueDays(dueDate, new Date('2026-10-01T17:00:00.000Z'), 'UTC'), 0)
  assert.equal(overdueDays(dueDate, new Date('2026-10-04T08:00:00.000Z'), 'UTC'), 3)
  assert.equal(calculateFine(3, 5).amount, 15)
})

test('pagination is bounded and reports total page count', () => {
  assert.deepEqual(getPagination({ page: '3', limit: '1000' }), { page: 3, limit: 100, skip: 200 })
  assert.deepEqual(paginationMeta(2, 20, 41), { page: 2, limit: 20, total: 41, totalPages: 3 })
})

test('loan dates use calendar-day addition', () => {
  assert.equal(addDays(new Date('2026-10-01T12:00:00.000Z'), 14).toISOString(), '2026-10-15T12:00:00.000Z')
})

test('reservation model accepts completed and rejected outcomes', () => {
  const common = {
    reservationId: 'RES-TEST-STATUS',
    studentId: '507f1f77bcf86cd799439011',
    bookTitleId: '507f1f77bcf86cd799439012',
    queuePosition: 1,
  }
  assert.equal(new Reservation({ ...common, status: 'COMPLETED' }).validateSync(), undefined)
  assert.equal(new Reservation({ ...common, status: 'REJECTED', rejectedAt: new Date(), rejectionReason: 'Unavailable' }).validateSync(), undefined)
})

test('reservation cancellation and rejection notifications are valid event types', () => {
  const common = {
    userId: '507f1f77bcf86cd799439011',
    title: 'Reservation update',
    message: 'Reservation state changed.',
  }
  assert.equal(new Notification({ ...common, type: 'RESERVATION_CANCELLED' }).validateSync(), undefined)
  assert.equal(new Notification({ ...common, type: 'RESERVATION_REJECTED' }).validateSync(), undefined)
})
