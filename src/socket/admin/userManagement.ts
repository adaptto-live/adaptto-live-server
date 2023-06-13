import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import { UserModel } from '../../repository/mongodb.schema'
import changeUsernameInAllDocuments from '../../util/changeUsernameInAllDocuments'

export async function handleAdminUserManagement(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin } = socket.data

  // admin-only operations
  if (!admin) {
    return
  }

  socket.on('adminGetUsers', async () => {
    log.debug('Admin: get users')
    const users = await UserModel.find().sort({username:1}).exec()
    socket.emit('adminUsers', users.map(user => 
        ({id: user.id, code: user.code, username: user.username, admin: user.admin, blocked: user.blocked,
          created: user.created, updated: user.updated})))
   })

  socket.on('adminUpdateUser', async (id, username, admin, blocked) => {
    log.debug(`Admin: update user ${username}`)
    const user = await UserModel.findOne({_id:id}).sort({username:1}).exec()
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
