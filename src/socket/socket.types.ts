export interface ServerToClientEvents {
  login: (userid: string, admin: boolean, qaadmin?: boolean) => void
  currentTalk: (talkId: string) => void
  talkRatings: (talkRatings: TalkRating[]) => void
  roomUsers: (usernames : string[]) => void
  talkModeratorNotes: (notes: ModeratorTalkNotesFromServer) => void
  messages: (messages: MessageFromServer[]) => void
  messageUpdate: (message: MessageFromServer) => void
  messageDelete: (id: string) => void
  qaEntries: (qaEntries: QAEntryFromServer[]) => void
  qaEntryUpdate: (qaEntry: QAEntryFromServer) => void
  qaEntryDelete: (id: string) => void
  adminLoginCodes: (loginCodes: LoginCode[]) => void
  adminUsers: (users: User[]) => void
  adminTalkRatings: (ratings: AverageTalkRating[]) => void
  adminStatistics: (statistics: Statistics) => void
  adminKPIDataset: (kpiDataset: KPIDataset) => void
  userBlocked: (userid: string) => void
}

export interface ClientToServerEvents {
  currentTalk: (talkId: string, callback: (result: OperationResult) => void) => void
  talkRating: (talkRating: TalkRating, callback: (result: OperationResult) => void) => void
  roomEnter: (talkId: string) => void
  roomLeave: (talkId: string) => void
  talkModeratorNotes: (notes: ModeratorTalkNotesToServer, callback: (result: OperationResult) => void) => void
  message: (message: MessageToServer, callback: (result: OperationResult) => void) => void
  messageUpdate: (message: MessageToServer, callback: (result: OperationResult) => void) => void
  messageDelete: (id: string, callback: (result: OperationResult) => void) => void
  qaEntry: (qaEntry: QAEntryToServer, callback: (result: OperationResult) => void) => void
  qaEntryUpdate: (qaEntry: QAEntryToServer, callback: (result: OperationResult) => void) => void
  qaEntryUpdateAnswered: (qaEntry: QAEntryAnsweredToServer, callback: (result: OperationResult) => void) => void
  qaEntryDelete: (id: string, callback: (result: OperationResult) => void) => void
  adminGetLoginCodes: () => void
  adminGetUsers: () => void
  adminUpdateUser: (user: UserUpdate, callback: (result: OperationResult) => void) => void
  adminGetTalkRatings: () => void
  adminGetStatistics: () => void
  adminGetKPI: (dayDates: Date[]) => void
}

export interface OperationResult {
  success: boolean
  error?: string
}

export interface TalkRating {
  talkId: string
  rating?: number
  comment? : string
}

export interface ModeratorTalkNotesFromServer {
  text: string
  updated: Date
}

export interface ModeratorTalkNotesToServer {
  talkId: string
  text: string
}

export interface MessageToServer {
  id: string
  talkId: string
  text: string
  highlight?: boolean
}

export interface MessageFromServer {
  id: string
  date: Date
  userid: string
  username: string
  text: string
  highlight?: boolean
}

export interface QAEntryToServer {
  id: string
  talkId: string
  text: string
  anonymous?: boolean
  replyTo?: string
  highlight?: boolean
  answered?: boolean
}

export interface QAEntryAnsweredToServer {
  id: string
  answered?: boolean
}

export interface QAEntryFromServer {
  id: string
  date: Date
  userid: string
  username?: string
  text: string
  replyTo?: string
  highlight?: boolean
  answered?: boolean
}

export interface LoginCode {
  code: string
  userid: string
  username:string
  used: Date
}

export interface User {
  id: string
  code: string
  username: string
  admin: boolean
  qaadmin: boolean
  blocked: boolean
  created: Date
  updated: Date
}

export interface UserUpdate {
  id: string
  username: string
  admin: boolean
  qaadmin: boolean
  blocked: boolean
}

export interface AverageTalkRating {
  talkId: string
  averageRating: number
  participants: number
  comments: string[]
}

export interface Statistics {
  numLoginCodes: number
  numUsers: number
  numTalkRatings: number
  numMessages: number
  numQAEntries: number
}

export interface KPIDataset {
  title: string
  xAxisTitle: string
  yAxisTitle: string
  days: KPIDatasetDay[]
}

export interface KPIDatasetDay {
  day: number
  values: { [key: number]: number }
}
