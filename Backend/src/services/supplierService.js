import Supplier from '../models/Supplier.js'
import Acquisition from '../models/Acquisition.js'
import ApiError from '../utils/ApiError.js'
import { listModel, getModelById, createModelRecord, updateModelRecord } from './resourceService.js'
import { recordAudit } from './auditService.js'

export function listSuppliers(query) {
  return listModel(Supplier, query, { fields: ['supplierName', 'contactPerson', 'email', 'phone'], filter: { deletedAt: null } })
}

export function getSupplier(id) {
  return getModelById(Supplier, id, { filter: { deletedAt: null } })
}

export async function createSupplier(values, user, req) {
  const supplier = await createModelRecord(Supplier, {
    ...values,
    supplierId: values.supplierId || `SUP-${Date.now().toString(36).toUpperCase()}`,
    status: String(values.status || 'ACTIVE').toUpperCase(),
  })
  await recordAudit({ action: 'SUPPLIER_CREATED', entityType: 'Supplier', entityId: supplier._id, user, req, description: `Created supplier ${supplier.supplierName}.` })
  return supplier
}

export async function updateSupplier(id, values, user, req) {
  const supplier = await updateModelRecord(Supplier, id, values, { filter: { deletedAt: null } })
  await recordAudit({ action: 'SUPPLIER_UPDATED', entityType: 'Supplier', entityId: supplier._id, user, req, description: `Updated supplier ${supplier.supplierName}.` })
  return supplier
}

export async function deleteSupplier(id, user, req) {
  const supplier = await Supplier.findOne({ _id: id, deletedAt: null })
  if (!supplier) throw ApiError.notFound('Supplier not found.')
  if (await Acquisition.exists({ supplierId: id })) throw ApiError.conflict('Supplier has acquisition history and cannot be deleted. Deactivate it instead.')
  supplier.status = 'INACTIVE'
  supplier.deletedAt = new Date()
  await supplier.save()
  await recordAudit({ action: 'SUPPLIER_DEACTIVATED', entityType: 'Supplier', entityId: supplier._id, user, req, description: `Deactivated supplier ${supplier.supplierName}.` })
  return supplier
}
