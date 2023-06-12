export interface ServerToClientEvents {
  login: (userid: string, admin: boolean) => void
  currentTalk: (talkId: string) => void
  talkRating: (talkId: string, rating?: number, comment?: string) => void
  roomUsers: (usernames : string[]) => void
  message: (id: string, date: Date, userid: string, username: string, text: string) => void
  messageUpdate: (id: string, date: Date, userid: string, username: string, text: string) => void
  messageDelete: (id: string) => void
  qaEntry: (id: string, date: Date, userid: string, username: string|undefined, text: string) => void
  qaEntryUpdate: (id: string, date: Date, userid: string, username: string|undefined, text: string) => void
  qaEntryDelete: (id: string) => void
  adminAllUsers: (users: {id: string, username: string, admin: boolean, blocked: boolean}[]) => void
  adminTalkRatings: (ratings: {talkId: string, averageRating: number, participants: number, comments: string[]}[]) => void
  adminStatistics: (numUsers: number, numTalkRatings: number, numMessages: number, numQAEntries: number) => void
}

export interface ClientToServerEvents {
  currentTalk: (talkId: string) => void
  talkRating: (talkId: string, rating?: number, comment? : string) => void
  roomEnter: (talkId: string) => void
  roomLeave: (talkId: string) => void
  message: (id: string, talkId: string, text: string) => void
  messageUpdate: (id: string, text: string) => void
  messageDelete: (id: string) => void
  qaEntry: (id: string, talkId: string, text: string, anonymous?: boolean) => void
  qaEntryUpdate: (id: string, text: string, anonymous?: boolean) => void
  qaEntryDelete: (id: string) => void
  adminGetAllUsers: () => void
  adminUpdateUser: (id: string, username: string, admin: boolean, blocked: boolean) => void
  adminGetTalkRatings: () => void
  adminGetStatistics: () => void
}

export interface InterServerEvents {} // eslint-disable-line @typescript-eslint/no-empty-interface
export interface SocketData {} // eslint-disable-line @typescript-eslint/no-empty-interface
