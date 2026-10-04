import Student from '../models/Student.js'
import ApiError from '../utils/ApiError.js'
import { STAFF_ROLES } from '../config/constants.js'

export async function requireSelfOrStaff(req, _res, next) {
  try {
    if (STAFF_ROLES.includes(req.user?.role)) return next()
    if (!['STUDENT', 'FACULTY'].includes(req.user?.role)) throw ApiError.forbidden()
    const student = await Student.findOne({ userId: req.user._id })
    if (!student || String(student._id) !== String(req.params.id || req.params.studentId)) throw ApiError.forbidden()
    return next()
  } catch (error) {
    return next(error)
  }
}
