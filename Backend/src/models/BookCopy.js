import mongoose from 'mongoose'
import { BOOK_COPY_STATUSES } from '../config/constants.js'
import { normalizeRfid } from '../utils/rfid.js'

const bookCopySchema = new mongoose.Schema({
  copyId: { type: String, required: true, unique: true, trim: true },
  copyNumber: { type: Number, min: 1 },
  bookTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookTitle', required: true, index: true },
  rfidUid: { type: String, required: true, unique: true, set: normalizeRfid },
  barcode: { type: String, sparse: true, unique: true, trim: true },
  accessionNumber: { type: String, sparse: true, unique: true, trim: true },
  status: { type: String, enum: BOOK_COPY_STATUSES, default: 'AVAILABLE', index: true },
  condition: { type: String, enum: ['GOOD', 'FAIR', 'DAMAGED', 'LOST'], default: 'GOOD' },
  location: String,
  acquisitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Acquisition', index: true },
  currentHolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  currentCirculationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circulation' },
  purchaseDate: Date,
  price: { type: Number, min: 0 },
  vendor: String,
  notes: String,
  lastIssuedAt: Date,
  lastReturnedAt: Date,
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: Date,
}, { timestamps: true })

bookCopySchema.index({ bookTitleId: 1, status: 1 })
export default mongoose.model('BookCopy', bookCopySchema)
