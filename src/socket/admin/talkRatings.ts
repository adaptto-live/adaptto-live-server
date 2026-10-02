import { Socket } from 'socket.io'
import { AverageTalkRating, ClientToServerEvents, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { TalkRatingModel, TalkRating } from '../../repository/mongodb.schema'

export async function handleAdminTalkRatings(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin, qaadmin } = socket.data

  // admin-only operations
  if (!(admin || qaadmin)) {
    return
  }

  socket.on('adminGetTalkRatings', async () => {
    log.debug('Admin: get talk ratings')
    const result = await calcTalkRatings()
    socket.emit('adminTalkRatings', result)   
  })

}

async function calcTalkRatings() : Promise<AverageTalkRating[]> {
  const talkRatings = await TalkRatingModel.find().exec()
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
  ratings: number[] = []
  comments: string[] = []

  constructor(talkId: string) {
    this.talkId = talkId
  }

  addTalkRating(talkRating : TalkRating) : void {
    this.ratings.push(talkRating.rating)
    const comment = talkRating.comment?.trim()
    if (comment != undefined && comment != '') {
      this.comments.push(comment)
    }
  }

  getAverageRating() : number {
    return this.ratings.reduce((sum, rating) => sum + rating, 0) / this.ratings.length
  }

  getMedianRating() : number {
    const sorted = [...this.ratings].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  // Sample standard deviation (like STDEV.S in Excel)
  getStandardDeviation() : number {
    if (this.ratings.length < 2) {
      return 0
    }
    const average = this.getAverageRating()
    const variance = this.ratings.reduce((sum, rating) => sum + (rating - average) ** 2, 0) / (this.ratings.length - 1)
    return Math.sqrt(variance)
  }

  getResult() : AverageTalkRating {
    return {
      talkId: this.talkId,
      averageRating: this.getAverageRating(),
      medianRating: this.getMedianRating(),
      standardDeviation: this.getStandardDeviation(),
      participants: this.ratings.length,
      comments: this.comments}
  }
}
