import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { UserModel } from '../../repository/mongodb.schema'
import changeUsernameInAllDocuments from '../../util/changeUsernameInAllDocuments'
import { userObject } from '../../repository/validation.schema'
import isInputValid from '../../util/isInputValid'

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
        ({id: user.id, code: user.code, username: user.username,
          admin: user.admin, qaadmin: user.qaadmin, blocked: user.blocked,
          created: user.created, updated: user.updated})))
   })

  socket.on('adminUpdateUser', async (userData, callback) => {
    if (!isInputValid(userObject, userData, callback)) {
      return
    }
 
    const {id, username, admin, qaadmin, blocked} = userData
    log.debug(`Admin: update user ${username}`)
    const user = await UserModel.findOne({_id:id}).sort({username:1}).exec()
    if (user) {
      const userNameChanged = user.username != username
      user.username = username
      user.admin = admin
      user.qaadmin = qaadmin
      user.blocked = blocked
      user.updated = new Date()
      await user.save()
      if (blocked) {
        socket.broadcast.emit('userBlocked', id)
      }
      if (userNameChanged) {
        await changeUsernameInAllDocuments(id, username)
      }
      callback({success:true})
    }
    else {
      callback({success:false, error:`User ${id} not found.`})
    }
  })

}
