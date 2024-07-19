import { MessageModel, QAEntryModel } from '../repository/mongodb.schema'
import log from './log'

export default async function changeUsernameInAllDocuments(userid: string, username: string) {
  log.info(`Change username in all messages and Q&A entries for ${userid} to '${username}'`)
  await MessageModel.updateMany({userid}, {username}).exec()
  await QAEntryModel.updateMany({userid, username:{ $ne: null }}, {username}).exec()
}
