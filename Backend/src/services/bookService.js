import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import Circulation from '../models/Circulation.js'
import mongoose from 'mongoose'
import ApiError from '../utils/ApiError.js'
import { normalizeRfid, generateUniqueRfid, claimRfid } from './rfidService.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'
import { getPagination } from '../utils/pagination.js'

function titleDto(title, copy) {
  const source = title.toObject ? title.toObject() : title
  const copyValue = copy?.toObject ? copy.toObject() : copy
  return {
    ...source,
    id: copyValue?.copyId || String(source._id),
    bookId: source.bookId,
    titleId: String(source._id),
    titleGroupId: String(source._id),
    copyId: copyValue?.copyId,
    copyNumber: copyValue?.copyNumber,
    rfidId: copyValue?.rfidUid,
    rfidUid: copyValue?.rfidUid,
    author: source.authors?.join(', ') || '',
    subCategory: source.subcategory,
    category: source.category,
    department: source.department,
    availabilityStatus: copyValue?.status === 'AVAILABLE' ? 'Available' : copyValue?.status,
    status: copyValue?.status === 'AVAILABLE' ? 'Available' : copyValue?.status || source.status,
    condition: copyValue?.condition || 'GOOD',
    location: copyValue?.location || source.shelfLocation,
    accessionNumber: copyValue?.accessionNumber,
    currentHolderId: copyValue?.currentHolderId,
    quantity: source.totalCopies,
    availableQuantity: source.availableCopies,
    totalCopies: source.totalCopies,
    availableCopies: source.availableCopies,
    archived: !source.isActive,
  }
}

function titleFilter(query) {
  const filter = { isActive: true }
  for (const key of ['category', 'subcategory', 'department', 'status']) if (query[key]) filter[key] = query[key]
  if (query.search) {
    const regex = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ title: regex }, { authors: regex }, { isbn: regex }, { category: regex }, { department: regex }]
  }
  for (const field of ['title', 'author']) {
    if (query[field]) {
      const regex = new RegExp(String(query[field]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [...(filter.$or || []), field === 'author' ? { authors: regex } : { title: regex }]
    }
  }
  for (const key of ['category', 'subcategory', 'department', 'isbn']) {
    if (query[key]) filter[key] = key === 'isbn' ? query[key] : query[key]
  }
  return filter
}

export async function listBooks(query) {
  const { page, limit, skip } = getPagination(query)
  if (query.rfid || query.copyId) {
    const copyFilter = { isActive: true }
    if (query.rfid) copyFilter.rfidUid = normalizeRfid(query.rfid)
    if (query.copyId) copyFilter.copyId = query.copyId
    const copies = await BookCopy.find(copyFilter).populate('bookTitleId')
    const data = copies.filter((copy) => copy.bookTitleId?.isActive).map((copy) => titleDto(copy.bookTitleId, copy))
    return { data, page, limit, total: data.length }
  }
  const filter = titleFilter(query)
  const [titles, total] = await Promise.all([
    BookTitle.find(filter).sort({ title: 1 }).skip(skip).limit(limit),
    BookTitle.countDocuments(filter),
  ])
  const copies = await BookCopy.find({ bookTitleId: { $in: titles.map((title) => title._id) }, isActive: true }).sort({ copyId: 1 })
  const byTitle = new Map()
  for (const copy of copies) {
    if (!byTitle.has(String(copy.bookTitleId))) byTitle.set(String(copy.bookTitleId), [])
    byTitle.get(String(copy.bookTitleId)).push(copy)
  }
  const data = titles.flatMap((title) => {
    const group = byTitle.get(String(title._id)) || []
    return group.length ? group.map((copy) => titleDto(title, copy)) : [titleDto(title)]
  })
  return { data, page, limit, total }
}

export async function getBook(id) {
  const title = mongoose.isValidObjectId(id) ? await BookTitle.findOne({ _id: id, isActive: true }) : null
  if (!title) {
    const copy = await BookCopy.findOne(mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { copyId: id }], isActive: true }
      : { copyId: id, isActive: true }).populate('bookTitleId')
    if (!copy?.bookTitleId) throw ApiError.notFound('Book not found.')
    return titleDto(copy.bookTitleId, copy)
  }
  const copy = await BookCopy.findOne({ bookTitleId: title._id, isActive: true }).sort({ copyId: 1 })
  return titleDto(title, copy)
}

export async function createBook(values, user, req) {
  const quantity = Math.max(1, Number(values.quantity || values.totalCopies || 1))
  const { title, copies } = await withTransaction(async (session) => {
    const [bookTitle] = await BookTitle.create([{
      ...values,
      bookId: values.bookId || `TITLE-${Date.now().toString(36).toUpperCase()}`,
      authors: Array.isArray(values.authors) ? values.authors : String(values.authors || values.author || '').split(',').map((value) => value.trim()).filter(Boolean),
      totalCopies: 0, availableCopies: 0,
    }], { session })
    const bookCopies = []
    for (let index = 0; index < quantity; index += 1) {
      const [copy] = await BookCopy.create([{
        copyId: index === 0 && values.copyId ? values.copyId : `COPY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        copyNumber: index + 1,
        bookTitleId: bookTitle._id,
        rfidUid: normalizeRfid(index === 0 && (values.rfidUid || values.rfidId) ? values.rfidUid || values.rfidId : await generateUniqueRfid(undefined, session)),
        accessionNumber: index === 0 && values.accessionNumber ? values.accessionNumber : `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        status: String(values.copyStatus || values.status || 'AVAILABLE').toUpperCase(),
        condition: String(values.condition || 'GOOD').toUpperCase(),
        location: values.location || values.shelfLocation,
        price: values.price,
      }], { session })
      await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id, session)
      bookCopies.push(copy)
    }
    bookTitle.totalCopies = quantity
    for (const copy of bookCopies) {
      const counter = {
        AVAILABLE: 'availableCopies', ISSUED: 'issuedCopies', RESERVED: 'reservedCopies',
        DAMAGED: 'damagedCopies', LOST: 'lostCopies', UNDER_REPAIR: 'underRepairCopies',
      }[copy.status]
      if (counter) bookTitle[counter] += 1
    }
    await bookTitle.save({ session })
    await recordAudit({ action: 'BOOK_CREATED', entityType: 'BookTitle', entityId: bookTitle._id, user, req, session, description: `Created book title ${bookTitle.title}.` })
    return { title: bookTitle, copies: bookCopies }
  })
  const copy = copies[0]
  return titleDto(title, copy)
}

export async function updateBook(id, values, user, req) {
  return withTransaction(async (session) => {
    let copy = await BookCopy.findOne(mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { copyId: id }], isActive: true }
      : { copyId: id, isActive: true }).session(session)
    const title = copy
      ? await BookTitle.findById(copy.bookTitleId).session(session)
      : mongoose.isValidObjectId(id) ? await BookTitle.findById(id).session(session) : null
    if (!title) throw ApiError.notFound('Book not found.')
    const payload = { ...values }
    if (payload.author && !payload.authors) payload.authors = payload.author.split(',').map((value) => value.trim()).filter(Boolean)
    if (payload.subCategory && !payload.subcategory) payload.subcategory = payload.subCategory
    for (const key of ['author', 'subCategory', 'rfidUid', 'rfidId', 'status', 'condition', 'location', 'accessionNumber', 'quantity', 'totalCopies', 'availableCopies', 'issuedCopies']) delete payload[key]
    Object.assign(title, payload)
    await title.save({ session })
    copy = values.copyId
      ? await BookCopy.findOne({ copyId: values.copyId, bookTitleId: title._id }).session(session)
      : copy || await BookCopy.findOne({ bookTitleId: title._id, isActive: true }).sort({ copyId: 1 }).session(session)
    if (copy && (values.rfidUid || values.rfidId || values.location || values.accessionNumber)) {
      if (values.rfidUid || values.rfidId) {
        copy.rfidUid = normalizeRfid(values.rfidUid || values.rfidId)
        await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id, session)
      }
      if (values.location) copy.location = values.location
      if (values.accessionNumber) copy.accessionNumber = values.accessionNumber
      await copy.save({ session })
    }
    await recordAudit({ action: 'BOOK_UPDATED', entityType: 'BookTitle', entityId: title._id, user, req, session, description: `Updated book title ${title.title}.` })
    return titleDto(title, copy)
  })
}

export async function archiveBook(id, user, req) {
  if (!mongoose.isValidObjectId(id)) {
    const copy = await BookCopy.findOne({ copyId: id, isActive: true })
    if (!copy) throw ApiError.notFound('Book not found.')
    const { archiveBookCopy } = await import('./bookCopyService.js')
    return archiveBookCopy(copy.copyId, user, req)
  }
  if (!(await BookTitle.exists({ _id: id }))) {
    const copy = await BookCopy.findById(id)
    if (!copy) throw ApiError.notFound('Book not found.')
    const { archiveBookCopy } = await import('./bookCopyService.js')
    return archiveBookCopy(copy.copyId, user, req)
  }
  return withTransaction(async (session) => {
    const title = await BookTitle.findById(id).session(session)
    if (!title) throw ApiError.notFound('Book not found.')
    if (await Circulation.exists({ bookTitleId: title._id, status: { $in: ['ISSUED', 'OVERDUE'] } }).session(session)) {
      throw ApiError.conflict('Cannot archive a title with active loans.')
    }
    title.isActive = false
    title.deletedAt = new Date()
    await title.save({ session })
    await BookCopy.updateMany({ bookTitleId: title._id }, { isActive: false, deletedAt: new Date() }, { session })
    await recordAudit({ action: 'BOOK_ARCHIVED', entityType: 'BookTitle', entityId: title._id, user, req, session, description: `Archived book title ${title.title}.` })
    return { id: title.id, archived: true }
  })
}

export async function bookCopies(id) {
  const title = mongoose.isValidObjectId(id) ? await BookTitle.findById(id) : null
  const copy = title ? null : await BookCopy.findOne({ copyId: id })
  const resolvedTitle = title || (copy ? await BookTitle.findById(copy.bookTitleId) : null)
  if (!resolvedTitle) throw ApiError.notFound('Book not found.')
  return BookCopy.find({ bookTitleId: resolvedTitle._id, isActive: true }).populate('currentHolderId', 'studentId registerNumber name department')
}

export async function bookAvailability(id) {
  const title = mongoose.isValidObjectId(id) ? await BookTitle.findById(id) : null
  const copy = title ? null : await BookCopy.findOne({ copyId: id })
  const resolvedTitle = title || (copy ? await BookTitle.findById(copy.bookTitleId) : null)
  if (!resolvedTitle) throw ApiError.notFound('Book not found.')
  return {
    titleId: resolvedTitle.id, title: resolvedTitle.title, totalCopies: resolvedTitle.totalCopies, availableCopies: resolvedTitle.availableCopies,
    issuedCopies: resolvedTitle.issuedCopies, reservedCopies: resolvedTitle.reservedCopies,
    available: resolvedTitle.availableCopies > 0,
  }
}

export async function bookHolder(id) {
  const copy = await BookCopy.findOne(mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { copyId: id }] } : { copyId: id }).populate('currentHolderId')
  if (!copy) throw ApiError.notFound('Book copy not found.')
  if (!copy.currentCirculationId) return null
  return Circulation.findById(copy.currentCirculationId).populate('studentId').populate('bookTitleId').populate('bookCopyId')
}

export async function bookHistory(id, query) {
  const copy = await BookCopy.findOne(mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { copyId: id }] } : { copyId: id })
  if (!copy) throw ApiError.notFound('Book copy not found.')
  const { page, limit, skip } = getPagination(query)
  const filter = { bookCopyId: copy._id }
  const [data, total] = await Promise.all([
    Circulation.find(filter).populate('studentId', 'studentId registerNumber name').sort({ issueDate: -1 }).skip(skip).limit(limit),
    Circulation.countDocuments(filter),
  ])
  return { data, page, limit, total }
}
