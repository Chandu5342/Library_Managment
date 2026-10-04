import BookTitle from '../models/BookTitle.js'
import BookCopy from '../models/BookCopy.js'
import { claimRfid, normalizeRfid } from '../services/rfidService.js'

const bookRecords = [
  ['Engineering Circuit Analysis', 'Network Analysis', 'ECE', ['William H. Hayt Jr.', 'Jack E. Kemmerly', 'Steven M. Durbin'], 2012, '8th Edition', '60 C0 3E 3B'],
  ['Network Analysis', 'Network Analysis', 'ECE', ['M. E. Van Valkenburg'], 1974, '3rd Edition', '4D A1 DE 6B'],
  ['Digital Electronics: Principles and Applications', 'Digital Electronics', 'ECE', ['Roger L. Tokheim'], 2013, '8th Edition', 'C3 FA 00 1D'],
  ['Digital Logic and Computer Design', 'Digital Electronics', 'ECE', ['M. Morris Mano'], 1979, '1st Edition', '14 D4 71 A9'],
  ['Electronic Devices and Circuit Theory', 'Analog Electronics', 'ECE', ['Robert L. Boylestad', 'Louis Nashelsky'], 2013, '11th Edition', 'A3 17 01 1D'],
  ['Fundamentals of Microelectronics', 'Analog Electronics', 'ECE', ['Behzad Razavi'], 2014, '2nd Edition', '32 D3 EF 06'],
  ['Programming in ANSI C', 'C Programming', 'CSE', ['E. Balagurusamy'], 2019, '8th Edition', 'FB 08 CC 19'],
  ['Let Us C: Authentic Guide to C Programming Language', 'C Programming', 'CSE', ['Yashavant Kanetkar'], 2020, '17th Edition', 'F0 D4 44 3B'],
  ['Microprocessor Architecture, Programming, and Applications with the 8085', 'Microprocessors & Microcontrollers', 'CSE', ['Ramesh S. Gaonkar'], 2002, '5th Edition', '33 D0 00 1D'],
  ['The 8051 Microcontroller and Embedded Systems', 'Microprocessors & Microcontrollers', 'CSE', ['Muhammad Ali Mazidi', 'Janice G. Mazidi', 'Rolin D. McKinlay'], 2014, '2nd Edition', 'E4 63 13 A9'],
]

export async function seedBooks() {
  for (const [index, [titleText, category, department, authors, publicationYear, edition, rfid]] of bookRecords.entries()) {
    const bookId = `SEED-TITLE-${String(index + 1).padStart(4, '0')}`
    const title = await BookTitle.findOne({ bookId }) || await BookTitle.findOne({ title: titleText })
    const titleRecord = title || new BookTitle()
    Object.assign(titleRecord, {
      bookId, title: titleText, category, department, authors, publicationYear, edition,
      isActive: true,
    })
    await titleRecord.save()
    const normalizedRfid = normalizeRfid(rfid)
    const copy = await BookCopy.findOneAndUpdate(
      { rfidUid: normalizedRfid },
      {
        $set: {
          bookTitleId: titleRecord._id,
        },
        $setOnInsert: {
          copyId: `SEED-COPY-${String(index + 1).padStart(4, '0')}`,
          rfidUid: normalizedRfid,
          accessionNumber: `SEED-ACC-${String(index + 1).padStart(4, '0')}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
          location: 'Vignan Institute of Information Technology Library',
          isActive: true,
        },
      },
      { upsert: true, new: true, runValidators: true },
    )
    await claimRfid(copy.rfidUid, 'BOOK_COPY', copy._id)
  }
  for (const title of await BookTitle.find({ bookId: /^SEED-TITLE-/ })) {
    const counts = await BookCopy.aggregate([
      { $match: { bookTitleId: title._id, isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const totals = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]))
    title.totalCopies = Object.values(totals).reduce((sum, count) => sum + count, 0)
    title.availableCopies = totals.AVAILABLE || 0
    title.issuedCopies = totals.ISSUED || 0
    title.reservedCopies = totals.RESERVED || 0
    title.damagedCopies = totals.DAMAGED || 0
    title.lostCopies = totals.LOST || 0
    title.underRepairCopies = totals.UNDER_REPAIR || 0
    await title.save()
  }
  console.info(`Ensured ${bookRecords.length} development book titles and tagged copies.`)
}
