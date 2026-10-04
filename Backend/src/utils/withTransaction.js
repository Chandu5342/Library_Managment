import mongoose from 'mongoose'
import { transactionsSupported } from '../config/db.js'

export async function withTransaction(operation) {
  if (!transactionsSupported) return operation(null)

  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await operation(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}
