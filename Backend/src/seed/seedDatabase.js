import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { seedBooks } from './seedBooks.js'
import { seedStudents } from './seedStudents.js'
import { seedUsers } from './seedUsers.js'
import LibrarySetting from '../models/LibrarySetting.js'

async function run() {
  if (env.nodeEnv === 'production') throw new Error('Development seed data cannot be loaded in production.')
  await connectDatabase()
  await LibrarySetting.findOneAndUpdate(
    { singletonKey: 'library' },
    { $set: { libraryName: 'Vignan Institute of Information Technology Library' }, $setOnInsert: { singletonKey: 'library' } },
    { upsert: true, new: true },
  )
  await seedUsers()
  await seedStudents()
  await seedBooks()
  console.info('Development seed completed without deleting existing data.')
}

run()
  .catch((error) => {
    console.error('Database seeding failed.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
