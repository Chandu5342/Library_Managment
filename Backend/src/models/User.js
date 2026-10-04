import mongoose from 'mongoose'
import { ROLES, INSTITUTION_NAME } from '../config/constants.js'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  refreshTokenHash: { type: String, select: false },
  role: { type: String, enum: ROLES, required: true, default: 'STUDENT', index: true },
  isActive: { type: Boolean, default: true, index: true },
  passwordChangeRequired: { type: Boolean, default: false },
  passwordChangedAt: Date,
  lastLoginAt: Date,
  profileImage: String,
  phone: String,
  libraryId: { type: String, trim: true, uppercase: true },
  institution: { type: String, default: INSTITUTION_NAME, trim: true },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
