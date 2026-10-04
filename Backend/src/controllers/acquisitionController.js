import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as acquisitions from '../services/acquisitionService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await acquisitions.listAcquisitions(req.query)
  return sendPage(res, 'Acquisitions retrieved successfully.', result.data, result)
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Acquisition retrieved successfully.', await acquisitions.getAcquisition(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Acquisition created successfully.', data: await acquisitions.createAcquisition(req.body, req.user, req), meta: {},
}))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Acquisition updated successfully.', await acquisitions.updateAcquisition(req.params.id, req.body, req.user, req)))
export const remove = asyncHandler(async (req, res) => sendSuccess(res, 'Acquisition cancelled successfully.', await acquisitions.cancelAcquisition(req.params.id, req.user, req)))
export const receive = asyncHandler(async (req, res) => sendSuccess(res, 'Acquisition receipt recorded successfully.', await acquisitions.receiveAcquisition(req.params.id, req.body.items, req.user, req)))
