import RfidLog from '../models/RfidLog.js'
import RfidDevice from '../models/RfidDevice.js'
import BookCopy from '../models/BookCopy.js'
import Student from '../models/Student.js'
import { getPagination } from '../utils/pagination.js'
import { normalizeRfid } from './rfidService.js'

export async function logRfid({ rfid, entityType = 'UNKNOWN', entityId, event, result = 'SUCCESS', user, location }) {
  return RfidLog.create({
    rfidUid: normalizeRfid(rfid), entityType, entityId, event, result,
    performedBy: user?._id, location,
  })
}

export async function listRfidLogs(query) {
  const { page, limit, skip } = getPagination(query)
  const [data, total] = await Promise.all([
    RfidLog.find(query.entityType ? { entityType: query.entityType } : {}).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('performedBy', 'name email'),
    RfidLog.countDocuments(query.entityType ? { entityType: query.entityType } : {}),
  ])
  return { data, page, limit, total }
}

export async function listRfidDevices() {
  return RfidDevice.find().sort({ name: 1 })
}

export async function logLookup(rfid, type, user) {
  const normalized = normalizeRfid(rfid)
  const entity = type === 'BOOK_COPY'
    ? await BookCopy.findOne({ rfidUid: normalized }).select('_id')
    : type === 'STUDENT'
      ? await Student.findOne({ rfidUid: normalized }).select('_id')
      : null
  return logRfid({ rfid, entityType: type, entityId: entity?._id, event: 'LOOKUP', result: entity ? 'SUCCESS' : 'NOT_FOUND', user })
}
