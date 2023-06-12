import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import AuthenticationInfo from '../../util/AuthenticationInfo'
import { TalkRatingModel, TalkRating } from '../../repository/mongodb.schema'

export async function handleAdminTalkRatings(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) : Promise<void> {

  // admin-only operations
  if (!authenticationInfo.admin) {
    return
  }

  socket.on('adminGetTalkRatings', async () => {
    log.debug('Admin: get talk ratings')
    const result = await calcTalkRatings()
    socket.emit('adminTalkRatings', result)   
  })

}

async function calcTalkRatings() : Promise<{talkId: string, averageRating: number, participants: number, comments: string[]}[]> {
  const talkRatings = await TalkRatingModel.find().sort({talkId:1,_id:1})
  const dataMap = new Map<string,TalkRatingData>()
  talkRatings.forEach(talkRating => {
    let data = dataMap.get(talkRating.talkId)
    if (!data) {
      data = new TalkRatingData(talkRating.talkId)
      dataMap.set(talkRating.talkId, data)
    }
    data.addTalkRating(talkRating)
  })
  return Array.from(dataMap.values()).map(data => data.getResult())
}

class TalkRatingData {
  talkId: string
  ratingSum = 0
  ratingCount = 0
  comments: string[] = []

  constructor(talkId: string) {
    this.talkId = talkId
  }

  addTalkRating(talkRating : TalkRating) : void {
    this.ratingCount++
    this.ratingSum += talkRating.rating
    const comment = talkRating.comment?.trim()
    if (comment != undefined && comment != '') {
      this.comments.push(comment)
    }
  }

  getAverageRating() : number {
    return this.ratingSum / this.ratingCount
  }

  getResult() : {talkId: string, averageRating: number, participants: number, comments: string[]} {
    return {
      talkId: this.talkId,
      averageRating: this.getAverageRating(),
      participants: this.ratingCount,
      comments: this.comments}
  }
}
