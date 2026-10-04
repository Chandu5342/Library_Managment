import ApiError from '../utils/ApiError.js'
import { getPagination } from '../utils/pagination.js'

export function buildSearchFilter(query, fields = []) {
  const filter = {}
  if (query.search) {
    const escaped = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    filter.$or = fields.map((field) => ({ [field]: regex }))
  }
  for (const key of ['status', 'department', 'branch', 'year', 'section', 'category', 'subcategory', 'isActive']) {
    if (query[key] !== undefined) filter[key] = key === 'isActive' ? query[key] === 'true' : query[key]
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(query.to)
  }
  return filter
}

export async function listModel(Model, query, { fields = [], populate = [], sort = { createdAt: -1 }, filter = {} } = {}) {
  const { page, limit, skip } = getPagination(query)
  const criteria = { ...filter, ...buildSearchFilter(query, fields) }
  const queryBuilder = Model.find(criteria).sort(sort).skip(skip).limit(limit)
  for (const item of populate) queryBuilder.populate(item)
  const [data, total] = await Promise.all([queryBuilder, Model.countDocuments(criteria)])
  return { data, page, limit, total }
}

export async function getModelById(Model, id, { populate = [], filter = {} } = {}) {
  let query = Model.findOne({ _id: id, ...filter })
  for (const item of populate) query = query.populate(item)
  const record = await query
  if (!record) throw ApiError.notFound()
  return record
}

export async function createModelRecord(Model, values, options = {}) {
  const [record] = await Model.create([values], options)
  return record
}

export async function updateModelRecord(Model, id, values, { filter = {} } = {}) {
  const record = await Model.findOneAndUpdate({ _id: id, ...filter }, { $set: values }, { new: true, runValidators: true })
  if (!record) throw ApiError.notFound()
  return record
}

export async function softDeleteModelRecord(Model, id, { filter = {} } = {}) {
  const record = await Model.findOneAndUpdate({ _id: id, ...filter }, { isActive: false, deletedAt: new Date() }, { new: true })
  if (!record) throw ApiError.notFound()
  return record
}
