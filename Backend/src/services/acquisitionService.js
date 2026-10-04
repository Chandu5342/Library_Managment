import Acquisition from '../models/Acquisition.js'
import Supplier from '../models/Supplier.js'
import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'
import { generateUniqueRfid, claimRfid } from './rfidService.js'
import { recordAudit } from './auditService.js'
import { withTransaction } from '../utils/withTransaction.js'

function normalizeItems(items = []) {
  return items.map((item) => {
    const quantityOrdered = Number(item.quantityOrdered ?? item.quantity)
    const unitCost = Number(item.unitCost ?? item.unitPrice ?? 0)
    if (!item.title?.trim() || !Number.isInteger(quantityOrdered) || quantityOrdered < 1 || unitCost < 0) {
      throw ApiError.badRequest('Each acquisition item requires a title, positive quantity, and non-negative unit cost.')
    }
    return {
      ...item,
      quantityOrdered,
      quantityReceived: Number(item.quantityReceived || 0),
      unitCost,
      totalCost: quantityOrdered * unitCost,
      authors: Array.isArray(item.authors) ? item.authors : String(item.author || '').split(',').map((author) => author.trim()).filter(Boolean),
    }
  })
}

export async function listAcquisitions(query) {
  const { page, limit, skip } = getPagination(query)
  const filter = {}
  for (const key of ['status', 'supplierId']) if (query[key]) filter[key] = query[key]
  const [data, total] = await Promise.all([
    Acquisition.find(filter).populate('supplierId').sort({ orderDate: -1 }).skip(skip).limit(limit),
    Acquisition.countDocuments(filter),
  ])
  return { data, page, limit, total }
}

export async function getAcquisition(id) {
  const record = await Acquisition.findById(id).populate('supplierId')
  if (!record) throw ApiError.notFound('Acquisition not found.')
  return record
}

export async function createAcquisition(values, user, req) {
  const items = normalizeItems(values.items?.length ? values.items : [values])
  if (values.supplierId && !(await Supplier.exists({ _id: values.supplierId, status: 'ACTIVE' }))) {
    throw ApiError.notFound('Active supplier not found.')
  }
  const acquisition = await Acquisition.create({
    ...values,
    acquisitionId: values.acquisitionId || `PO-${Date.now().toString(36).toUpperCase()}`,
    items,
    status: values.status || 'ORDERED',
    totalQuantity: items.reduce((total, item) => total + item.quantityOrdered, 0),
    receivedQuantity: 0,
    totalCost: items.reduce((total, item) => total + item.totalCost, 0),
    createdBy: user._id,
  })
  await recordAudit({
    action: 'ACQUISITION_CREATED', entityType: 'Acquisition', entityId: acquisition._id,
    user, req, description: `Created acquisition ${acquisition.acquisitionId}.`,
  })
  return acquisition
}

export async function updateAcquisition(id, values, user, req) {
  const acquisition = await Acquisition.findById(id)
  if (!acquisition) throw ApiError.notFound('Acquisition not found.')
  if (!['DRAFT', 'ORDERED'].includes(acquisition.status)) throw ApiError.conflict('Only draft or ordered acquisitions can be edited.')
  if (values.items) {
    const items = normalizeItems(values.items)
    values.items = items
    values.totalQuantity = items.reduce((total, item) => total + item.quantityOrdered, 0)
    values.totalCost = items.reduce((total, item) => total + item.totalCost, 0)
  }
  Object.assign(acquisition, values)
  await acquisition.save()
  await recordAudit({
    action: 'ACQUISITION_UPDATED', entityType: 'Acquisition', entityId: acquisition._id,
    user, req, description: `Updated acquisition ${acquisition.acquisitionId}.`,
  })
  return acquisition
}

export async function cancelAcquisition(id, user, req) {
  const acquisition = await Acquisition.findById(id)
  if (!acquisition) throw ApiError.notFound('Acquisition not found.')
  if (acquisition.status === 'RECEIVED' || acquisition.status === 'PARTIALLY_RECEIVED') {
    throw ApiError.conflict('An acquisition with received items cannot be cancelled.')
  }
  acquisition.status = 'CANCELLED'
  await acquisition.save()
  await recordAudit({
    action: 'ACQUISITION_CANCELLED', entityType: 'Acquisition', entityId: acquisition._id,
    user, req, description: `Cancelled acquisition ${acquisition.acquisitionId}.`,
  })
  return acquisition
}

export async function receiveAcquisition(id, requestedItems, user, req) {
  return withTransaction(async (session) => {
    const acquisition = await Acquisition.findById(id).session(session)
    if (!acquisition) throw ApiError.notFound('Acquisition not found.')
    if (acquisition.status === 'CANCELLED' || acquisition.status === 'RECEIVED') throw ApiError.conflict('Acquisition is not open for receiving.')
    const requested = requestedItems?.length ? requestedItems : acquisition.items.map((item) => ({ itemId: item._id, quantity: item.quantityOrdered - item.quantityReceived }))
    let receivedThisCall = 0
    for (const requestItem of requested) {
      const item = acquisition.items.id(requestItem.itemId)
      if (!item) throw ApiError.badRequest('Acquisition item was not found.')
      const quantity = Number(requestItem.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || item.quantityReceived + quantity > item.quantityOrdered) {
        throw ApiError.badRequest(`Received quantity is invalid for "${item.title}".`)
      }
      let title = item.bookTitleId ? await BookTitle.findById(item.bookTitleId).session(session) : null
      if (!title) {
        const matcher = item.isbn ? { isbn: item.isbn, isActive: true } : { title: item.title, isActive: true }
        title = await BookTitle.findOne(matcher).session(session)
      }
      if (!title) {
        title = await BookTitle.create([{
          bookId: `TITLE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          title: item.title,
          authors: item.authors || [],
          isbn: item.isbn || undefined,
          category: item.category,
          subcategory: item.subcategory,
          department: item.department,
          publicationYear: item.publicationYear,
          edition: item.edition,
          totalCopies: 0,
          availableCopies: 0,
        }], { session }).then(([value]) => value)
      }
      item.bookTitleId = title._id
      for (let copyIndex = 0; copyIndex < quantity; copyIndex += 1) {
        const copy = await BookCopy.create([{
          copyId: `COPY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          bookTitleId: title._id,
          rfidUid: (await generateUniqueRfid(BookCopy, session)).replace(/\s/g, ''),
          accessionNumber: `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
          acquisitionId: acquisition._id,
          purchaseDate: acquisition.orderDate,
          price: item.unitCost,
          vendor: String(acquisition.supplierId || ''),
        }], { session }).then(([value]) => value)
        await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id, session)
        title.totalCopies += 1
        title.availableCopies += 1
        await title.save({ session })
        await BookCopy.updateOne({ _id: copy._id }, { $set: { acquisitionId: acquisition._id } }, { session })
      }
      item.quantityReceived += quantity
      receivedThisCall += quantity
    }
    acquisition.receivedQuantity += receivedThisCall
    const allReceived = acquisition.items.every((item) => item.quantityReceived >= item.quantityOrdered)
    acquisition.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
    acquisition.receivedDate = allReceived ? new Date() : undefined
    await acquisition.save({ session })
    await recordAudit({
      action: 'ACQUISITION_RECEIVED', entityType: 'Acquisition', entityId: acquisition._id,
      user, req, session, description: `Received ${receivedThisCall} copy/copies against ${acquisition.acquisitionId}.`,
      metadata: { quantity: receivedThisCall },
    })
    return acquisition
  })
}
