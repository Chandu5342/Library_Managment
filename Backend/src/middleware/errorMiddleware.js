import mongoose from 'mongoose'
import ApiError from '../utils/ApiError.js'
import { env } from '../config/env.js'

export function errorMiddleware(error, _req, res, _next) {
  let statusCode = error.statusCode || 500
  let message = statusCode === 500 ? 'An unexpected server error occurred.' : error.message
  let errors = error.errors || []

  if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400
    message = 'Request validation failed.'
    errors = Object.values(error.errors).map((entry) => ({ field: entry.path, message: entry.message }))
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = 'Invalid resource identifier.'
  } else if (error?.code === 11000) {
    statusCode = 409
    message = `A record with this ${Object.keys(error.keyPattern || {})[0] || 'value'} already exists.`
  } else if (error?.code === 20 && /transaction numbers are only allowed/i.test(error.message || '')) {
    statusCode = 503
    message = 'This operation requires MongoDB to run as a replica set so the update can be committed atomically.'
  } else if (!(error instanceof ApiError) && statusCode >= 500) {
    console.error(error)
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors: env.nodeEnv === 'development' ? errors : [],
  })
}
