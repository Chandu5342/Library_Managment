import mongoose from 'mongoose'

const bookTitleSchema = new mongoose.Schema({
  bookId: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true, index: 'text' },
  subtitle: String,
  authors: { type: [String], default: [] },
  isbn: { type: String, trim: true, sparse: true },
  publisher: String,
  publicationYear: Number,
  edition: String,
  language: String,
  category: { type: String, index: true },
  subcategory: { type: String, index: true },
  department: { type: String, index: true },
  description: String,
  coverImage: String,
  subjectTags: { type: [String], default: [] },
  classificationNumber: String,
  shelfLocation: String,
  rackNumber: String,
  totalCopies: { type: Number, default: 0, min: 0 },
  availableCopies: { type: Number, default: 0, min: 0 },
  issuedCopies: { type: Number, default: 0, min: 0 },
  reservedCopies: { type: Number, default: 0, min: 0 },
  damagedCopies: { type: Number, default: 0, min: 0 },
  lostCopies: { type: Number, default: 0, min: 0 },
  underRepairCopies: { type: Number, default: 0, min: 0 },
  status: { type: String, default: 'ACTIVE', index: true },
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: Date,
}, { timestamps: true })

bookTitleSchema.index({ title: 'text', authors: 'text', isbn: 'text', category: 'text' })
bookTitleSchema.index({ category: 1, department: 1, title: 1 })
export default mongoose.model('BookTitle', bookTitleSchema)
