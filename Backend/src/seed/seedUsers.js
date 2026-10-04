import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { INSTITUTION_NAME } from '../config/constants.js'

const accountSeed = [
  { name: 'Library Administrator', email: 'admin@gmail.com', password: 'admin@123', role: 'ADMIN', legacyEmail: 'admin@northbridge.edu' },
  { name: 'Library Librarian LIB01', email: 'lib01@gmail.com', password: 'lib01@123', role: 'LIBRARIAN', libraryId: 'LIB01' },
  { name: 'Library Librarian LIB02', email: 'lib02@gmail.com', password: 'lib02@123', role: 'LIBRARIAN', libraryId: 'LIB02' },
  { name: 'Library Librarian', email: 'lib001@gmail.com', password: '126', role: 'LIBRARIAN', legacyEmail: 'librarian@northbridge.edu', libraryId: 'LIB001' },
]

export async function seedUsers() {
  const users = new Map()
  for (const account of accountSeed) {
    const passwordHash = await bcrypt.hash(account.password, 12)
    let user = await User.findOne({ email: account.email.toLowerCase() })
    if (!user && account.legacyEmail) {
      user = await User.findOne({ email: account.legacyEmail.toLowerCase() })
      if (user) {
        user.name = account.name
        user.email = account.email.toLowerCase()
        user.role = account.role
        user.libraryId = account.libraryId
        user.institution = INSTITUTION_NAME
        user.passwordHash = passwordHash
        user.passwordChangeRequired = true
        user.passwordChangedAt = undefined
        user.isActive = true
        await user.save()
      }
    }
    if (!user) {
      user = await User.create({
        name: account.name,
        email: account.email.toLowerCase(),
        role: account.role,
        libraryId: account.libraryId,
        institution: INSTITUTION_NAME,
        passwordHash,
        passwordChangeRequired: true,
        isActive: true,
      })
    } else {
      user.name = account.name
      user.role = account.role
      user.libraryId = account.libraryId
      user.institution = INSTITUTION_NAME
      user.passwordHash = passwordHash
      user.passwordChangeRequired = true
      user.passwordChangedAt = undefined
      user.isActive = true
      await user.save()
    }
    users.set(account.email.toLowerCase(), user)
  }
  return users
}
