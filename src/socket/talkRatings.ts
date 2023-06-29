import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { TalkRatingModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { v4 as uuidv4 } from 'uuid'
import { talkRatingObject } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'

export async function handleTalkRatings(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username } = socket.data

  // emit all existing talk ratings on login
  const talkRatings = (await TalkRatingModel.find({userid}).exec())
      .map(({ talkId, rating, comment }) => ({ talkId, rating, comment}))
  if (talkRatings.length > 0) {
    socket.emit('talkRatings', talkRatings)
  }

  // store talk ratings
  socket.on('talkRating', async (talkRating, callback) => {
    if (!isInputValid(talkRatingObject, talkRating, callback)) {
      return
    }

    const { talkId, rating, comment } = talkRating
    await TalkRatingModel.deleteMany({talkId, userid}).exec()
    if (rating) {
      log.debug(`User ${username} rated talk ${talkId} with ${rating}`)
      await TalkRatingModel.create({_id: uuidv4(), talkId, userid, rating, comment, created: new Date()})
    }
    else {
      log.debug(`User ${username} removed talk rating for ${talkId}`)
    }
    callback({success:true})
  })

}
