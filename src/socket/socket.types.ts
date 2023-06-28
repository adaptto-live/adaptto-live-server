export interface ServerToClientEvents {
  login: (userid: string, admin: boolean) => void
  currentTalk: (talkId: string) => void
  talkRating: (talkId: string, rating?: number, comment?: string) => void
  roomUsers: (usernames : string[]) => void
  message: (id: string, date: Date, userid: string, username: string, text: string) => void
  messageUpdate: (id: string, date: Date, userid: string, username: string, text: string) => void
  messageDelete: (id: string) => void
  qaEntry: (id: string, date: Date, userid: string, username: string|undefined, text: string, replyTo?: string) => void
  qaEntryUpdate: (id: string, date: Date, userid: string, username: string|undefined, text: string) => void
  qaEntryDelete: (id: string) => void
  adminLoginCodes: (loginCodes: {code: string, userid: string, username:string, used: Date}[]) => void
  adminUsers: (users: {id: string, code: string, username: string, admin: boolean, blocked: boolean, created: Date, updated: Date}[]) => void
  adminTalkRatings: (ratings: {talkId: string, averageRating: number, participants: number, comments: string[]}[]) => void
  adminStatistics: (numLoginCodes: number, numUsers: number, numTalkRatings: number, numMessages: number, numQAEntries: number) => void
  userBlocked: (userid: string) => void
}

export interface ClientToServerEvents {
  currentTalk: (talkId: string) => void
  talkRating: (talkId: string, rating?: number, comment? : string) => void
  roomEnter: (talkId: string) => void
  roomLeave: (talkId: string) => void
  message: (id: string, talkId: string, text: string) => void
  messageUpdate: (id: string, text: string) => void
  messageDelete: (id: string) => void
  qaEntry: (id: string, talkId: string, text: string, anonymous?: boolean, replyTo?: string) => void
  qaEntryUpdate: (id: string, text: string, anonymous?: boolean) => void
  qaEntryDelete: (id: string) => void
  adminGetLoginCodes: () => void
  adminGetUsers: () => void
  adminUpdateUser: (id: string, username: string, admin: boolean, blocked: boolean) => void
  adminGetTalkRatings: () => void
  adminGetStatistics: () => void
}
