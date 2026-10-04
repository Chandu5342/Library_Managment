import LibrarySetting from '../models/LibrarySetting.js'

export async function getSettings(session) {
  let settings = await LibrarySetting.findOne({ singletonKey: 'library' }).session(session || null)
  if (!settings) {
    [settings] = await LibrarySetting.create([{ singletonKey: 'library' }], { session })
  }
  return settings
}

export async function updateSettings(values) {
  return LibrarySetting.findOneAndUpdate(
    { singletonKey: 'library' },
    { $set: values, $setOnInsert: { singletonKey: 'library' } },
    { new: true, upsert: true, runValidators: true },
  )
}
