import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import log from '../util/log'
import { UserModel } from '../repository/mongodb.schema'
import changeUsernameInAllDocuments from '../util/changeUsernameInAllDocuments'

export async function handleConnection(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin, qaadmin, usernameChanged } = socket.data
  if (!userid || !username) {
    return
  }

  // check for changed user name
  if (usernameChanged) {
    log.debug(`User name change detected for ${userid}: ${username}`)
    const user = await UserModel.findOne({_id:userid}).exec()
    if (user) {
      user.username = username
      user.updated = new Date()
      await user.save()
      await changeUsernameInAllDocuments(userid, username)
    }
  }

  log.debug(`User connected: ${username}`)
  socket.emit('login', userid, admin ?? false, qaadmin ?? false)

  // user disconnects
  socket.on('disconnect', () => {
    log.debug(`User disconnected: ${username}`)
  })

  return { userid, username, admin }
}
