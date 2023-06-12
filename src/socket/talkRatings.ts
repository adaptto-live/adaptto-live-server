import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
import { TalkRatingModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { v4 as uuidv4 } from 'uuid'
import AuthenticationInfo from '../util/AuthenticationInfo'

export async function handleTalkRatings(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) : Promise<void> {
  const { userid, username } = authenticationInfo

  // emit all existing talk ratings on login
  ;(await TalkRatingModel.find({userid})).forEach(doc => {
    socket.emit('talkRating', doc.talkId, doc.rating, doc.comment)
  })

  // store talk ratings
  socket.on('talkRating', async (talkId: string, rating?: number, comment? : string) => {
    await TalkRatingModel.deleteMany({talkId, userid})
    if (rating) {
      log.debug(`User ${username} rated talk ${talkId} with ${rating}`)
      TalkRatingModel.create({_id: uuidv4(), talkId, userid, rating, comment})
    }
    else {
      log.debug(`User ${username} removed talk rating for ${talkId}`)
    }
  })

}
