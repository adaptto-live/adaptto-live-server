import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
import { UserModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { v4 as uuidv4 } from 'uuid'
import AuthenticationInfo from '../util/AuthenticationInfo'

export async function handleConnection(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) : Promise<AuthenticationInfo> {

  // check/create user
  const username = socket.handshake.auth.username
  let userid : string
  let admin : boolean
  const existingUser = await UserModel.findOne({username}).exec()
  if (existingUser) {
    userid = existingUser._id
    admin = existingUser.admin
    log.debug(`User connected: ${username}`)
  }
  else {
    userid = uuidv4()
    admin = false
    await UserModel.create({_id:userid, username})
    log.debug(`User connected (new user): ${username}`)
  }
  socket.emit('login', userid, admin)

  // user disconnects
  socket.on('disconnect', () => {
    log.debug(`User disconnected: ${username}`)
  })

  return { userid, username, admin }
}
