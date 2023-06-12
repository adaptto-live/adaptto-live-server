import mongoose from 'mongoose'

export interface User {
  _id: string
  username: string
  admin: boolean
  blocked: boolean
}
const UserSchema = new mongoose.Schema<User>({
  _id: { type: String, required:true },
  username: { type: String, required:true, index:true },
  admin: { type: Boolean, required:false },
  blocked: { type: Boolean, required:false }
})
export const UserModel = mongoose.model<User>('user', UserSchema)

interface CurrentTalk {
  _id: string
  talkId: string
}
const CurrentTalkSchema = new mongoose.Schema<CurrentTalk>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true }
})
export const CurrentTalkModel = mongoose.model<CurrentTalk>('currentTalk', CurrentTalkSchema)

export interface TalkRating {
  _id: string
  talkId: string
  userid: string
  rating: number
  comment: string
}
const TalkRatingSchema = new mongoose.Schema<TalkRating>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  userid: { type: String, required:true, index:true },
  rating: { type: Number, required:true },
  comment: { type: String, required:false }
})
export const TalkRatingModel = mongoose.model<TalkRating>('talk-rating', TalkRatingSchema)

export interface Message {
  _id: string
  talkId: string
  date: Date
  userid: string
  username: string
  text: string
}
const MessageSchema = new mongoose.Schema<Message>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  date: { type: Date, default: Date.now, index:true },
  userid: { type: String, required:true },
  username: { type: String, required:true },
  text: { type: String, required:true }
})
export const MessageModel = mongoose.model<Message>('message', MessageSchema)

export interface QAEntry {
  _id: string
  talkId: string
  date: Date
  userid: string
  username?: string
  text: string
}
const QAEntrySchema = new mongoose.Schema<QAEntry>({
  _id: { type: String, required:true },
  talkId: { type: String, required:true, index:true },
  date: { type: Date, default: Date.now, index:true },
  userid: { type: String, required:true },
  username: { type: String, required:false },
  text: { type: String, required:true }
})
export const QAEntryModel = mongoose.model<QAEntry>('qa-entry', QAEntrySchema)
