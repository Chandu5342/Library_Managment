import asyncHandler from '../utils/asyncHandler.js'
import { sendPage, sendSuccess } from '../utils/responseFormatter.js'
import * as books from '../services/bookService.js'

export const list = asyncHandler(async (req, res) => {
  const result = await books.listBooks(req.query)
  return sendPage(res, 'Books retrieved successfully.', result.data, result)
})
export const search = list
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Book retrieved successfully.', await books.getBook(req.params.id)))
export const create = asyncHandler(async (req, res) => res.status(201).json({
  success: true, message: 'Book created successfully.', data: await books.createBook(req.body, req.user, req), meta: {},
}))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Book updated successfully.', await books.updateBook(req.params.id, req.body, req.user, req)))
export const remove = asyncHandler(async (req, res) => sendSuccess(res, 'Book archived successfully.', await books.archiveBook(req.params.id, req.user, req)))
export const copies = asyncHandler(async (req, res) => sendSuccess(res, 'Book copies retrieved successfully.', await books.bookCopies(req.params.id)))
export const availability = asyncHandler(async (req, res) => sendSuccess(res, 'Book availability retrieved successfully.', await books.bookAvailability(req.params.id)))
export const holder = asyncHandler(async (req, res) => sendSuccess(res, 'Book holder retrieved successfully.', await books.bookHolder(req.params.id)))
export const history = asyncHandler(async (req, res) => {
  const result = await books.bookHistory(req.params.id, req.query)
  return sendPage(res, 'Book history retrieved successfully.', result.data, result)
})
