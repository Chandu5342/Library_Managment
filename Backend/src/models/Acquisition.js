import mongoose from 'mongoose'

const acquisitionItemSchema = new mongoose.Schema({
  bookTitleId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookTitle' },
  title: { type: String, required: true, trim: true },
  authors: [String],
  author: String,
  isbn: String,
  category: String,
  subcategory: String,
  department: String,
  publicationYear: Number,
  edition: String,
  quantityOrdered: { type: Number, required: true, min: 1 },
  quantityReceived: { type: Number, default: 0, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
}, { _id: true })

const acquisitionSchema = new mongoose.Schema({
  acquisitionId: { type: String, required: true, unique: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true },
  orderDate: { type: Date, default: Date.now },
  expectedDate: Date,
  receivedDate: Date,
  status: { type: String, enum: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'], default: 'DRAFT', index: true },
  items: { type: [acquisitionItemSchema], default: [] },
  totalQuantity: { type: Number, default: 0 },
  receivedQuantity: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('Acquisition', acquisitionSchema)
