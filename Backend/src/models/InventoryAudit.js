import mongoose from 'mongoose'

const inventoryAuditSchema = new mongoose.Schema({
  auditId: { type: String, required: true, unique: true },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'IN_PROGRESS', index: true },
  location: String,
  department: String,
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  expectedCopyIds: [String],
  scannedCopyIds: [String],
  missingCopyIds: [String],
  unexpectedCopyIds: [String],
  misplacedCopyIds: [String],
}, { timestamps: true })

export default mongoose.model('InventoryAudit', inventoryAuditSchema)
