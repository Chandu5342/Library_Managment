import mongoose from 'mongoose'
import { env } from './env.js'

export let transactionsSupported = false

export async function connectDatabase() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.mongoUri, { dbName: 'library_management' })
  const topology = await mongoose.connection.db.admin().command({ hello: 1 })
  transactionsSupported = Boolean(topology.setName || topology.msg === 'isdbgrid')
  console.info(`MongoDB connected: ${mongoose.connection.name}`)
  if (!transactionsSupported) {
    console.warn('MongoDB is running standalone; multi-document workflows will run without transaction guarantees.')
  }
}
