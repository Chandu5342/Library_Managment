import mongoose from 'mongoose'
import { normalizeRfid } from '../utils/rfid.js'
import { INSTITUTION_NAME } from '../config/constants.js'

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId: { type: String, required: true, unique: true, trim: true },
  registerNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  libraryId: { type: String, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true, index: true },
  institution: { type: String, default: INSTITUTION_NAME, trim: true },
  rfidUid: { type: String, unique: true, sparse: true, set: normalizeRfid },
  department: { type: String, trim: true, index: true },
  branch: String,
  year: { type: String, index: true },
  section: { type: String, index: true },
  memberType: { type: String, enum: ['Student', 'Faculty', 'Staff', 'Librarian'], default: 'Student' },
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  dateOfBirth: Date,
  gender: String,
  address: String,
  guardianName: String,
  guardianPhone: String,
  profileImage: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED'], default: 'ACTIVE', index: true },
  membershipStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED'], default: 'ACTIVE', index: true },
  maximumBooksAllowed: { type: Number, min: 0 },
  currentBooksCount: { type: Number, default: 0, min: 0 },
  totalBooksIssued: { type: Number, default: 0, min: 0 },
  totalBooksReturned: { type: Number, default: 0, min: 0 },
  overdueBooksCount: { type: Number, default: 0, min: 0 },
  outstandingFine: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: Date,
}, { timestamps: true })

studentSchema.index({ department: 1, year: 1, section: 1, status: 1 })
studentSchema.index({ userId: 1 }, { unique: true, sparse: true })
export default mongoose.model('Student', studentSchema)
