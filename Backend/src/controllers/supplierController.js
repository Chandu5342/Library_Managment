import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as suppliers from '../services/supplierService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await suppliers.listSuppliers(req.query)
  return sendPage(res, 'Suppliers retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Supplier retrieved successfully.', await suppliers.getSupplier(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Supplier created successfully.', data: await suppliers.createSupplier(req.body, req.user, req), meta: {},
}))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Supplier updated successfully.', await suppliers.updateSupplier(req.params.id, req.body, req.user, req)))
export const remove = asyncHandler(async (req, res) => sendSuccess(res, 'Supplier deactivated successfully.', await suppliers.deleteSupplier(req.params.id, req.user, req)))
