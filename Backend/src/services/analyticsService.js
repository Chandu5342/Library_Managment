import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import Circulation from '../models/Circulation.js'
import Student from '../models/Student.js'
import Reservation from '../models/Reservation.js'
import Fine from '../models/Fine.js'

export async function dashboardSummary() {
  const [titleCount, copyCounts, studentCount, activeReservations, overdueBooks, outstandingFines] = await Promise.all([
    BookTitle.countDocuments({ isActive: true }),
    BookCopy.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Student.countDocuments({ isActive: true }),
    Reservation.countDocuments({ status: { $in: ['PENDING', 'READY_FOR_PICKUP'] } }),
    Circulation.countDocuments({ status: { $in: ['ISSUED', 'OVERDUE'] }, dueDate: { $lt: new Date() } }),
    Fine.aggregate([{ $match: { status: { $in: ['PENDING', 'PARTIALLY_PAID'] } } }, { $group: { _id: null, amount: { $sum: '$remainingAmount' } } }]),
  ])
  const counts = Object.fromEntries(copyCounts.map((item) => [item._id, item.count]))
  return {
    totalTitles: titleCount,
    totalCopies: Object.values(counts).reduce((sum, count) => sum + count, 0),
    availableCopies: counts.AVAILABLE || 0,
    issuedCopies: counts.ISSUED || 0,
    reservedCopies: counts.RESERVED || 0,
    damagedCopies: counts.DAMAGED || 0,
    lostCopies: counts.LOST || 0,
    underRepairCopies: counts.UNDER_REPAIR || 0,
    totalStudents: studentCount,
    activeReservations,
    overdueBooks,
    outstandingFines: outstandingFines[0]?.amount || 0,
  }
}

export async function analyticsOverview() {
  const [summary, mostBorrowed, categories, activeStudents, departments, trends] = await Promise.all([
    dashboardSummary(),
    mostBorrowedBooks({ limit: 5 }),
    mostBorrowedCategories({ limit: 8 }),
    mostActiveStudents({ limit: 5 }),
    departmentUsage(),
    circulationTrends({ days: 30 }),
  ])
  return { ...summary, mostBorrowedBooks: mostBorrowed, mostBorrowedCategories: categories, mostActiveStudents: activeStudents, departmentUsage: departments, circulationTrends: trends }
}

export function mostBorrowedBooks(query = {}) {
  return Circulation.aggregate([
    { $group: { _id: '$bookTitleId', borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } }, { $limit: Math.min(50, Number(query.limit) || 10) },
    { $lookup: { from: 'booktitles', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' }, { $project: { _id: 1, title: '$book.title', authors: '$book.authors', category: '$book.category', borrowCount: 1 } },
  ])
}

export function mostBorrowedCategories(query = {}) {
  return Circulation.aggregate([
    { $lookup: { from: 'booktitles', localField: 'bookTitleId', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' }, { $group: { _id: '$book.category', borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } }, { $limit: Math.min(50, Number(query.limit) || 10) },
  ])
}

export function mostActiveStudents(query = {}) {
  return Circulation.aggregate([
    { $group: { _id: '$studentId', borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } }, { $limit: Math.min(50, Number(query.limit) || 10) },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' }, { $project: { borrowCount: 1, studentId: '$student.studentId', registerNumber: '$student.registerNumber', name: '$student.name', department: '$student.department' } },
  ])
}

export function departmentUsage() {
  return Circulation.aggregate([
    { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' }, { $group: { _id: '$student.department', borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } },
  ])
}

export function circulationTrends(query = {}) {
  const days = Math.min(365, Math.max(1, Number(query.days) || 30))
  const from = new Date()
  from.setDate(from.getDate() - days)
  return Circulation.aggregate([
    { $match: { issueDate: { $gte: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } }, issues: { $sum: 1 }, returns: { $sum: { $cond: [{ $ne: ['$returnDate', null] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ])
}

export function overdueTrends(query = {}) {
  const days = Math.min(365, Math.max(1, Number(query.days) || 30))
  const from = new Date()
  from.setDate(from.getDate() - days)
  return Circulation.aggregate([
    { $match: { dueDate: { $gte: from, $lt: new Date() }, status: { $in: ['ISSUED', 'OVERDUE', 'RETURNED'] } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$dueDate' } }, overdueCount: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
}

export function reservationDemand() {
  return Reservation.aggregate([
    { $group: { _id: '$bookTitleId', reservationCount: { $sum: 1 }, pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } } } },
    { $sort: { reservationCount: -1 } }, { $limit: 20 },
    { $lookup: { from: 'booktitles', localField: '_id', foreignField: '_id', as: 'book' } }, { $unwind: '$book' },
    { $project: { title: '$book.title', reservationCount: 1, pendingCount: 1 } },
  ])
}
