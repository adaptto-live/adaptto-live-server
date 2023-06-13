import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import AuthenticationInfo from '../../util/AuthenticationInfo'
import { UserModel, MessageModel, QAEntryModel } from '../../repository/mongodb.schema'

export async function handleAdminUserManagement(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) {

  // admin-only operations
  if (!authenticationInfo.admin) {
    return
  }

  socket.on('adminGetAllUsers', async () => {
    log.debug('Admin: get all users')
    await emitAllUsers(socket)
  })

  socket.on('adminUpdateUser', async (id, username, admin, blocked) => {
    log.debug(`Admin: update user ${username}`)
    const user = await UserModel.findOne({_id:id}).exec()
    if (user) {
      const userNameChanged = user.username != username
      user.username = username
      user.admin = admin
      user.blocked = blocked
      user.updated = new Date()
      await user.save()
      if (userNameChanged) {
        await changeUsernameInAllDocuments(id, username)
      }
    }
  })

}

async function emitAllUsers(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const users = await UserModel.find().sort({username:1}).exec()
  socket.emit('adminAllUsers', users.map(user => 
      ({id: user.id, username: user.username, admin: user.admin, blocked: user.blocked})))
}

async function changeUsernameInAllDocuments(userid: string, username: string) {
  await MessageModel.updateMany({userid}, {username}).exec()
  await QAEntryModel.updateMany({userid, username:{ $ne: null }}, {username}).exec()
}
