import { Socket } from 'socket.io'
import { ClientToServerEvents, ModeratorTalkNotesToServer, OperationResult, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { TalkModeratorNotesModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { talkModeratorNotesToServerObject } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'

/**
 * Handle talk moderator notes - available only for Q&A admin/admin users.
 */
export async function handleTalkRoomModeratorNotes(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin, qaadmin } = socket.data
  if (!userid || !username || !(qaadmin || admin)) {
    return
  }

  // CRUD handling for chat messages
  socket.on('moderatorTalkNotes', handleNewOrUpdate)

  async function handleNewOrUpdate(notes: ModeratorTalkNotesToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(talkModeratorNotesToServerObject, notes, callback)) {
      return
    }

    const { id, talkId, text } = notes
    const updated = new Date()

    const existingNotes = await TalkModeratorNotesModel.findOne({talkId})
    if (existingNotes != null) {
      log.debug(`Update moderator talk notes for ${talkId}: ${text}`)
      existingNotes.text = text
      await existingNotes.save()
      callback({success: true})
    }
    else {
      log.debug(`Create moderator talk notes for ${talkId}: ${text}`)
      await TalkModeratorNotesModel.create({ _id:id, talkId, text, updated })
      callback({success: true})
    }
  }

}
