import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import AuthenticationInfo from '../../util/AuthenticationInfo'
import { UserModel } from '../../repository/mongodb.schema'
import { MessageModel } from '../../repository/mongodb.schema'
import { QAEntryModel } from '../../repository/mongodb.schema'

export async function handleAdminUserManagement(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) : Promise<void> {

  // admin-only operations
  if (!authenticationInfo.admin) {
    return
  }

  socket.on('adminGetAllUsers', async () => {
    log.debug('Admin: get all users')
    emitAllUsers(socket)
  })

  socket.on('adminUpdateUser', async (id, username, admin, blocked) => {
    log.debug(`Admin: update user ${username}`)
    const user = await UserModel.findOne({_id:id})
    if (user) {
      const userNameChanged = user.username != username
      user.username = username
      user.admin = admin
      user.blocked = blocked
      await user.save()
      if (userNameChanged) {
        changeUsernameInAllDocuments(id, username)
      }
    }
  })

}

async function emitAllUsers(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const users = await UserModel.find().sort({username:1,_id:1})    
  socket.emit('adminAllUsers', users.map(user => 
      ({id: user.id, username: user.username, admin: user.admin, blocked: user.blocked})))
}

async function changeUsernameInAllDocuments(userid: string, username: string) : Promise<void> {
  const messages = await MessageModel.find({userid})
  messages.forEach(message => {
    message.username = username
    message.save()
  })
  const qaEntries = await QAEntryModel.find({userid})
  qaEntries.forEach(qaEntry => {
    if (qaEntry.username) {
      qaEntry.username = username
      qaEntry.save()
    }
  })
}
