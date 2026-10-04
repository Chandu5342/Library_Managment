import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true, unique: true },
  supplierName: { type: String, required: true, trim: true },
  contactPerson: String,
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  address: String,
  city: String,
  state: String,
  country: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  notes: String,
  deletedAt: Date,
}, { timestamps: true })

export default mongoose.model('Supplier', supplierSchema)
