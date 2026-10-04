import bcrypt from 'bcryptjs'
import Student from '../models/Student.js'
import User from '../models/User.js'
import Circulation from '../models/Circulation.js'
import Fine from '../models/Fine.js'
import Reservation from '../models/Reservation.js'
import BookCopy from '../models/BookCopy.js'
import ApiError from '../utils/ApiError.js'
import { listModel, getModelById } from './resourceService.js'
import { normalizeRfid, claimRfid, generateUniqueRfid } from './rfidService.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { env } from '../config/env.js'
import { createNotification } from './notificationService.js'

const roleByMemberType = {
  Student: 'STUDENT',
  Faculty: 'FACULTY',
  Librarian: 'LIBRARIAN',
  Staff: 'ASSISTANT_LIBRARIAN',
}

function normalizedMembershipStatus(value) {
  const status = String(value || 'ACTIVE').toUpperCase()
  if (status === 'BLOCKED') return 'SUSPENDED'
  if (status === 'ACTIVE' || status === 'INACTIVE' || status === 'SUSPENDED' || status === 'GRADUATED') return status
  return 'ACTIVE'
}

function loginIdentifier(values) {
  const memberType = values.memberType || 'Student'
  const identifier = memberType === 'Student' || memberType === 'Faculty'
    ? values.registerNumber || values.registrationNumber || values.studentId
    : values.libraryId || values.registerNumber || values.registrationNumber || values.studentId
  if (!identifier) throw ApiError.badRequest('A student registration number or staff library ID is required.')
  return String(identifier).trim().toUpperCase()
}

export function studentDto(student) {
  const value = student.toObject ? student.toObject() : student
  return {
    ...value,
    id: String(value._id),
    memberId: String(value._id),
    registrationNumber: value.registerNumber,
    rfidCardId: value.rfidUid,
    booksIssued: value.totalBooksIssued,
    booksReturned: value.totalBooksReturned,
    borrowedBooks: value.currentBooksCount,
    overdueBooks: value.overdueBooksCount,
    fineAmount: value.outstandingFine,
    archived: !value.isActive,
    status: value.status === 'ACTIVE' ? 'Active' : value.status,
  }
}

export async function listStudents(query) {
  const filter = { isActive: true }
  for (const key of ['registerNumber', 'studentId', 'department', 'branch', 'year', 'section', 'status', 'membershipStatus']) {
    if (query[key]) filter[key] = ['status', 'membershipStatus'].includes(key) ? query[key].toUpperCase() : query[key]
  }
  if (query.rfid) filter.rfidUid = normalizeRfid(query.rfid)
  if (query.name) filter.name = new RegExp(String(query.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const pageResult = await listModel(Student, query, {
    fields: ['name', 'registerNumber', 'studentId', 'email', 'rfidUid'],
    filter,
  })
  return { ...pageResult, data: pageResult.data.map(studentDto) }
}

export async function getStudent(id) {
  return studentDto(await getModelById(Student, id, { filter: { isActive: true } }))
}

export async function createStudent(values, user, req) {
  if (!env.initialMemberPassword) throw ApiError.badRequest('Set INITIAL_MEMBER_PASSWORD before provisioning member accounts in production.')
  const memberType = values.memberType || 'Student'
  const registerNumber = loginIdentifier({ ...values, memberType })
  const studentId = registerNumber
  const email = `${registerNumber.toLowerCase()}@gmail.com`
  return withTransaction(async (session) => {
    const rfidUid = values.rfidUid || values.rfidCardId
      ? normalizeRfid(values.rfidUid || values.rfidCardId)
      : await generateUniqueRfid(undefined, session)
    if (await User.exists({ email }).session(session)) throw ApiError.conflict('An account already exists for this member ID.')
    const memberUser = await User.create([{
      name: values.name,
      email,
      phone: values.phone,
      profileImage: values.profileImage,
      role: roleByMemberType[memberType] || 'STUDENT',
      passwordHash: await bcrypt.hash(env.initialMemberPassword, 12),
      passwordChangeRequired: true,
    }], { session }).then(([created]) => created)
    const [student] = await Student.create([{
      ...values,
      studentId,
      registerNumber,
      userId: memberUser._id,
      email,
      memberType,
      rfidUid,
      status: normalizedMembershipStatus(values.status),
      membershipStatus: normalizedMembershipStatus(values.membershipStatus || values.status),
    }], { session })
    await claimRfid(student.rfidUid, 'STUDENT', student._id, session)
    await createNotification({
      userId: memberUser._id,
      type: 'SYSTEM',
      title: 'Library account created',
      message: `Your library login is ${email}. Sign in with the temporary password provided by library staff and change it immediately.`,
      entityType: 'Student',
      entityId: student._id,
      session,
    })
    await recordAudit({ action: 'STUDENT_CREATED', entityType: 'Student', entityId: student._id, user, req, session, description: `Created ${memberType.toLowerCase()} member ${student.name}.`, metadata: { userId: memberUser._id, email } })
    return { ...studentDto(student), loginEmail: email, temporaryPassword: env.initialMemberPassword, passwordChangeRequired: true }
  })
}

export async function updateStudent(id, values, user, req) {
  return withTransaction(async (session) => {
    const student = await Student.findOne({ _id: id, isActive: true }).session(session)
    if (!student) throw ApiError.notFound('Student not found.')
    const payload = { ...values }
    if (payload.registrationNumber && !payload.registerNumber) payload.registerNumber = payload.registrationNumber
    if (payload.rfidCardId && !payload.rfidUid) payload.rfidUid = payload.rfidCardId
    if (payload.rfidUid) payload.rfidUid = normalizeRfid(payload.rfidUid)
    if (payload.status) payload.status = normalizedMembershipStatus(payload.status)
    if (payload.membershipStatus) payload.membershipStatus = normalizedMembershipStatus(payload.membershipStatus)
    const memberType = payload.memberType || student.memberType
    const identifier = loginIdentifier({
      ...student.toObject(),
      ...payload,
      memberType,
      libraryId: payload.libraryId || student.libraryId,
    })
    const email = `${identifier.toLowerCase()}@gmail.com`
    const linkedUser = student.userId ? await User.findById(student.userId).session(session) : null
    if (linkedUser) {
      if (await User.exists({ email, _id: { $ne: linkedUser._id } }).session(session)) {
        throw ApiError.conflict('Another account already uses this member ID.')
      }
      linkedUser.name = payload.name || student.name
      linkedUser.email = email
      linkedUser.phone = payload.phone ?? student.phone
      linkedUser.profileImage = payload.profileImage ?? student.profileImage
      linkedUser.role = roleByMemberType[memberType] || linkedUser.role
      if (payload.status && ['INACTIVE', 'SUSPENDED', 'GRADUATED'].includes(payload.status)) linkedUser.isActive = false
      if (payload.status === 'ACTIVE') linkedUser.isActive = true
      await linkedUser.save({ session })
    }
    payload.email = email
    payload.studentId = identifier
    payload.registerNumber = identifier
    delete payload.registrationNumber
    delete payload.rfidCardId
    Object.assign(student, payload)
    await student.save({ session })
    if (student.rfidUid) await claimRfid(student.rfidUid, 'STUDENT', student._id, session)
    await recordAudit({ action: 'STUDENT_UPDATED', entityType: 'Student', entityId: student._id, user, req, session, description: `Updated student ${student.name}.` })
    return studentDto(student)
  })
}

export async function archiveStudent(id, user, req) {
  const student = await getModelById(Student, id, { filter: { isActive: true } })
  if (await Circulation.exists({ studentId: id, status: { $in: ['ISSUED', 'OVERDUE'] } })) {
    throw ApiError.conflict('Cannot deactivate a student with active loans.')
  }
  student.isActive = false
  student.deletedAt = new Date()
  student.status = 'INACTIVE'
  student.membershipStatus = 'INACTIVE'
  await student.save()
  if (student.userId) await User.updateOne({ _id: student.userId }, { $set: { isActive: false } })
  await recordAudit({ action: 'STUDENT_ARCHIVED', entityType: 'Student', entityId: student._id, user, req, description: `Deactivated student ${student.name}.` })
  return studentDto(student)
}

export async function findStudentByRfid(rfid) {
  const student = await Student.findOne({ rfidUid: normalizeRfid(rfid), isActive: true })
  if (!student) throw ApiError.notFound('No active student matches this RFID.')
  const dto = studentDto(student)
  const [currentBooks, history, fines, reservations, overdueBooksCount, account] = await Promise.all([
    BookCopy.find({ currentHolderId: student._id }).populate('bookTitleId').populate('currentCirculationId'),
    Circulation.find({ studentId: student._id }).populate('bookTitleId').populate('bookCopyId').sort({ issueDate: -1 }).limit(50),
    Fine.find({ studentId: student._id }).sort({ createdAt: -1 }),
    Reservation.find({ studentId: student._id }).populate('bookTitleId').sort({ requestDate: -1 }),
    Circulation.countDocuments({
      studentId: student._id, status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() },
    }),
    student.userId ? User.findById(student.userId).select('email role isActive') : null,
  ])
  dto.overdueBooksCount = overdueBooksCount
  dto.overdueBooks = dto.overdueBooksCount
  return {
    ...dto,
    account: account ? { email: account.email, role: account.role, isActive: account.isActive } : null,
    currentBooks: currentBooks.map((copy) => ({ ...copy.toObject(), id: copy.copyId, title: copy.bookTitleId?.title, authors: copy.bookTitleId?.authors })),
    history,
    fines,
    reservations,
  }
}

export async function getCurrentStudent(userId) {
  const student = await Student.findOne({ userId, isActive: true })
  if (!student) throw ApiError.notFound('Student profile is not linked to this account.')
  const currentBooksValue = await currentBooks(student._id)
  const overdueCount = await Circulation.countDocuments({
    studentId: student._id, status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() },
  })
  return { ...studentDto(student), overdueBooksCount: overdueCount, overdueBooks: overdueCount, currentBooks: currentBooksValue }
}

export async function studentHistory(id, query) {
  const student = await getModelById(Student, id, { filter: { isActive: true } })
  const pageResult = await listModel(Circulation, query, {
    filter: { studentId: student._id },
    populate: ['bookTitleId', 'bookCopyId'],
    sort: { issueDate: -1 },
  })
  return pageResult
}

export async function currentBooks(id) {
  const student = await getModelById(Student, id, { filter: { isActive: true } })
  return BookCopy.find({ currentHolderId: student._id }).populate('bookTitleId').populate('currentCirculationId')
}

export async function studentFines(id, query) {
  await getModelById(Student, id)
  return listModel(Fine, query, { filter: { studentId: id }, sort: { createdAt: -1 } })
}

export async function studentReservations(id, query) {
  await getModelById(Student, id)
  return listModel(Reservation, query, { filter: { studentId: id }, populate: ['bookTitleId'], sort: { requestDate: -1 } })
}
