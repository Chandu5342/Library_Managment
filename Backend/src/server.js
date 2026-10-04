import app from './app.js'
import { env } from './config/env.js'
import { connectDatabase } from './config/db.js'

try {
  await connectDatabase()
  const server = app.listen(env.port, () => console.info(`Library API listening on port ${env.port}.`))
  const shutdown = async (signal) => {
    console.info(`${signal} received; closing HTTP server.`)
    server.close(async () => {
      const mongoose = await import('mongoose')
      await mongoose.default.disconnect()
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
} catch (error) {
  console.error('Unable to start Library API.', error)
  process.exitCode = 1
}
