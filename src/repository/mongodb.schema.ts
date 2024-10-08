import mongoose from 'mongoose'

export interface LoginCode {
  code: string
  userid: string
  used: Date
}
const LoginCodeSchema = new mongoose.Schema<LoginCode>({
  code: { type: String, required:true, index:true },
  userid: { type: String, required:false, index:true },
  used: { type: Date, required:false }
})
LoginCodeSchema.index({code: 1, userid: 1})
export const LoginCodeModel = mongoose.model<LoginCode>('loginCode', LoginCodeSchema)

export interface User {
  _id: string
  code: string
  username: string
  admin: boolean
  qaadmin: boolean
  blocked: boolean
  created: Date
  updated: Date
}
const UserSchema = new mongoose.Schema<User>({
  _id: { type: String, required:true },
  code: { type: String, required:true, index:true },
  username: { type: String, required:true, index:true },
  admin: { type: Boolean, required:false },
  qaadmin: { type: Boolean, required:false },
  blocked: { type: Boolean, required:false },
  created: { type: Date, required:true },
  updated: { type: Date, required:false }
})
export const UserModel = mongoose.model<User>('user', UserSchema)

interface CurrentTalk {
  _id: string
  talkId: string
  created: Date
}
const CurrentTalkSchema = new mongoose.Schema<CurrentTalk>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true },
  created: { type: Date, required:true }
})
export const CurrentTalkModel = mongoose.model<CurrentTalk>('currentTalk', CurrentTalkSchema)

export interface TalkRating {
  _id: string
  talkId: string
  userid: string
  rating: number
  comment: string
  created: Date
}
const TalkRatingSchema = new mongoose.Schema<TalkRating>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  userid: { type: String, required:true, index:true },
  rating: { type: Number, required:true },
  comment: { type: String, required:false },
  created: { type: Date, required:true }
})
export const TalkRatingModel = mongoose.model<TalkRating>('talk-rating', TalkRatingSchema)

export interface TalkModeratorNotes {
  _id: string
  talkId: string
  text: string
  updated: Date
}
const TalkModeratorNotesSchema = new mongoose.Schema<TalkModeratorNotes>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  text: { type: String },
  updated: { type: Date, default: Date.now }
})
export const TalkModeratorNotesModel = mongoose.model<TalkModeratorNotes>('talk-moderator-notes', TalkModeratorNotesSchema)

export interface Message {
  _id: string
  talkId: string
  date: Date
  userid: string
  username: string
  text: string
  highlight?: boolean
}
const MessageSchema = new mongoose.Schema<Message>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  date: { type: Date, default: Date.now, index:true },
  userid: { type: String, required:true, index:true },
  username: { type: String, required:true },
  text: { type: String, required:true },
  highlight: { type: Boolean, required:false }
})
export const MessageModel = mongoose.model<Message>('message', MessageSchema)

export interface QAEntry {
  _id: string
  talkId: string
  date: Date
  userid: string
  username?: string
  text: string
  entryIndex?: number
  replyTo?: string
  highlight?: boolean
  answered?: boolean
}
const QAEntrySchema = new mongoose.Schema<QAEntry>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  date: { type: Date, default: Date.now, index:true },
  userid: { type: String, required:true, index:true },
  username: { type: String, required:false },
  text: { type: String, required:true },
  entryIndex: { type: Number, required:false, index:true },
  replyTo: { type: String, required:false, index:true },
  highlight: { type: Boolean, required:false },
  answered: { type: Boolean, required:false }
})
QAEntrySchema.index({userid: 1, username: 1})
QAEntrySchema.index({talkId: 1, entryIndex: 1}, { unique: true, partialFilterExpression: { entryIndex: { $gt: 0 } } })
export const QAEntryModel = mongoose.model<QAEntry>('qa-entry', QAEntrySchema)

export interface QAEntryLike {
  _id: string
  talkId: string
  qaEntryId: string
  date: Date
  userid: string
}
const QAEntryLikeSchema = new mongoose.Schema<QAEntryLike>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  qaEntryId: { type: String, required:true, index:true },
  date: { type: Date, default: Date.now, index:true },
  userid: { type: String, required:true, index:true }
})
QAEntrySchema.index({qaEntryId: 1, userid: 1})
export const QAEntryLikeModel = mongoose.model<QAEntryLike>('qa-entry-like', QAEntryLikeSchema)
