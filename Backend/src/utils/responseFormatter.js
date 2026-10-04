import { paginationMeta } from './pagination.js'

export function sendSuccess(res, message, data, meta = {}) {
  return res.json({ success: true, message, data, meta })
}

export function sendPage(res, message, data, { page, limit, total }) {
  return sendSuccess(res, message, data, paginationMeta(page, limit, total))
}
