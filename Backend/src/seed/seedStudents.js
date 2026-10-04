import bcrypt from 'bcryptjs'
import Student from '../models/Student.js'
import User from '../models/User.js'
import { claimRfid, normalizeRfid } from '../services/rfidService.js'
import { INSTITUTION_NAME } from '../config/constants.js'

export const seedStudentRecords = [
  ['Ganireddy Pujeetha', '23L31A0414', '95 92 4F 06', '23L31A0414@123'],
  ['Gogireddy Haswanth', '23L31A0450', '8D E1 66 06', '23L31A0450@123'],
  ['Desavath Abhishek', '24L35A0403', '94 0C A5 A9', '24L35A0403@123'],
  ['Geddavalasa Vivek', '23L31A0449', '64 D9 5B A9', '23L31A0449@123'],
]

export async function seedStudents() {
  for (const [name, registerNumber, rfid, temporaryPassword] of seedStudentRecords) {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)
    const email = `${registerNumber.toLowerCase()}@gmail.com`
    let student = await Student.findOne({ registerNumber })
    let memberUser = await User.findOne({ email })

    if (!memberUser && student?.userId) {
      memberUser = await User.findById(student.userId)
      if (memberUser) {
        memberUser.email = email
        memberUser.passwordHash = passwordHash
        memberUser.role = 'STUDENT'
        memberUser.institution = INSTITUTION_NAME
        memberUser.passwordChangeRequired = true
        memberUser.passwordChangedAt = undefined
        memberUser.isActive = true
        await memberUser.save()
      }
    }
    if (!memberUser) {
      memberUser = await User.findOneAndUpdate(
        { email },
        { $set: { name, email, role: 'STUDENT', institution: INSTITUTION_NAME, passwordHash, passwordChangeRequired: true, isActive: true }, $unset: { passwordChangedAt: 1 } },
        { upsert: true, new: true, runValidators: true },
      )
    } else {
      memberUser.name = name
      memberUser.passwordHash = passwordHash
      memberUser.role = 'STUDENT'
      memberUser.institution = INSTITUTION_NAME
      memberUser.passwordChangeRequired = true
      memberUser.passwordChangedAt = undefined
      memberUser.isActive = true
      await memberUser.save()
    }
    student = await Student.findOneAndUpdate(
      { registerNumber },
      {
        $set: {
          studentId: registerNumber,
          registerNumber,
          libraryId: registerNumber,
          userId: memberUser._id,
          name,
          institution: INSTITUTION_NAME,
          rfidUid: normalizeRfid(rfid),
          department: 'ECE',
          branch: 'Electronics and Communication Engineering',
          year: '4th Year',
          section: 'A',
          memberType: 'Student',
          email,
          status: 'ACTIVE',
          membershipStatus: 'ACTIVE',
          isActive: true,
        },
        $setOnInsert: { maximumBooksAllowed: 5, currentBooksCount: 0, totalBooksIssued: 0, totalBooksReturned: 0 },
      },
      { upsert: true, new: true, runValidators: true },
    )
    await claimRfid(student.rfidUid, 'STUDENT', student._id)
  }
  console.info(`Ensured ${seedStudentRecords.length} linked development student accounts.`)
}
