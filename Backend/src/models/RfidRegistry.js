import mongoose from 'mongoose'
import { normalizeRfid } from '../utils/rfid.js'

const rfidRegistrySchema = new mongoose.Schema({
  rfidUid: { type: String, required: true, unique: true, set: normalizeRfid },
  entityType: { type: String, enum: ['BOOK_COPY', 'STUDENT'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true })

rfidRegistrySchema.index({ entityType: 1, entityId: 1 })
export default mongoose.model('RfidRegistry', rfidRegistrySchema)
