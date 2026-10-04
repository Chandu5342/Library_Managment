import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import Student from '../models/Student.js'
import Circulation from '../models/Circulation.js'
import Fine from '../models/Fine.js'
import Reservation from '../models/Reservation.js'
import Acquisition from '../models/Acquisition.js'
import { getPagination } from '../utils/pagination.js'

function filters(query, fields = []) {
  const match = {}
  if (query.status) match.status = query.status.toUpperCase()
  if (query.department) match.department = query.department
  if (query.category) match.category = query.category
  if (query.from || query.to) {
    match.createdAt = {}
    if (query.from) match.createdAt.$gte = new Date(query.from)
    if (query.to) match.createdAt.$lte = new Date(query.to)
  }
  if (query.search) {
    const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    match.$or = fields.map((field) => ({ [field]: new RegExp(escaped, 'i') }))
  }
  return match
}

async function page(Model, query, match, populate = []) {
  const { page: current, limit, skip } = getPagination(query)
  let find = Model.find(match)
  for (const spec of populate) find = find.populate(spec)
  const [data, total] = await Promise.all([find.sort({ createdAt: -1 }).skip(skip).limit(limit), Model.countDocuments(match)])
  return { data, page: current, limit, total }
}

export async function reportBooks(query) {
  const result = await page(BookTitle, query, { isActive: true, ...filters(query, ['title', 'authors', 'isbn']) })
  return { ...result, data: result.data }
}
export function reportStudents(query) {
  return page(Student, query, { isActive: true, ...filters(query, ['name', 'registerNumber', 'studentId']) })
}
export async function reportCirculation(query) {
  const match = { ...filters(query) }
  delete match.department
  delete match.category
  delete match.createdAt
  if (query.from || query.to) {
    match.issueDate = {}
    if (query.from) match.issueDate.$gte = new Date(query.from)
    if (query.to) match.issueDate.$lte = new Date(query.to)
  }
  if (query.department) {
    const students = await Student.find({ department: query.department }).select('_id')
    match.studentId = { $in: students.map((student) => student._id) }
  }
  if (query.category) {
    const titles = await BookTitle.find({ category: query.category }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  return page(Circulation, query, match, ['studentId', 'bookTitleId', 'bookCopyId'])
}
export async function reportOverdue(query) {
  const match = { status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() } }
  if (query.department) {
    const students = await Student.find({ department: query.department }).select('_id')
    match.studentId = { $in: students.map((student) => student._id) }
  }
  if (query.category) {
    const titles = await BookTitle.find({ category: query.category }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  return page(Circulation, query, match, ['studentId', 'bookTitleId', 'bookCopyId'])
}
export async function reportFines(query) {
  const match = { ...filters(query) }
  delete match.department
  delete match.category
  if (query.department) {
    const students = await Student.find({ department: query.department }).select('_id')
    match.studentId = { $in: students.map((student) => student._id) }
  }
  if (query.category) {
    const titles = await BookTitle.find({ category: query.category }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  return page(Fine, query, match, ['studentId', 'circulationId', 'bookTitleId'])
}
export async function reportReservations(query) {
  const match = { ...filters(query) }
  delete match.department
  delete match.category
  if (query.department) {
    const students = await Student.find({ department: query.department }).select('_id')
    match.studentId = { $in: students.map((student) => student._id) }
  }
  if (query.category) {
    const titles = await BookTitle.find({ category: query.category }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  return page(Reservation, query, match, ['studentId', 'bookTitleId'])
}
export function reportAcquisitions(query) {
  return page(Acquisition, query, filters(query), ['supplierId'])
}
export async function reportInventory(query) {
  const match = { isActive: true }
  if (query.status) match.status = query.status.toUpperCase()
  if (query.department) {
    const titles = await BookTitle.find({ department: query.department }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  if (query.category) {
    const titles = await BookTitle.find({ category: query.category }).select('_id')
    match.bookTitleId = { $in: titles.map((title) => title._id) }
  }
  return page(BookCopy, query, match, ['bookTitleId', 'currentHolderId'])
}
