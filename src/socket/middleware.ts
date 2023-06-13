import { Socket } from 'socket.io'
import log from '../util/log'
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from './socket.types'
import { ExtendedError } from 'socket.io/dist/namespace'
import { LoginCodeModel, UserModel } from '../repository/mongodb.schema'
import { v4 as uuidv4 } from 'uuid'

// this is executed when a new Websocket connection is created
export async function middleware(
    socket: Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    next: (err?: ExtendedError) => void) {

  // validate presence of valid login code and username
  const code = socket.handshake.auth.code
  const username = socket.handshake.auth.username
  if (!code || !username) {
    log.debug('Reject request without auth.code and auth.username property.')
    next(new Error('Not authorized'))
    return
  }

  // check fo existing user for this login code
  const existingUser = await UserModel.findOne({code}).exec()
  if (existingUser) {
    if (existingUser.blocked) {
      // reject connection if user is blocked
      log.debug(`Reject blocked user: ${existingUser.username}, code ${code}`)
      next(new Error(`User '${existingUser.username}' is blocked.`))
      return
    }
    else {
      // allow existing user
      socket.data.userid = existingUser._id
      socket.data.username = username
      socket.data.admin = existingUser.admin
      socket.data.usernameChanged = (existingUser.username != username)
      next()
      return
    }
  }

  // check logincode to register a new user
  const loginCode = await LoginCodeModel.findOne({code}).exec()
  if (loginCode) {
    // create new user for valid login code
    const userid = uuidv4()
    await UserModel.create({_id:userid, code, username, created: new Date()})
    log.debug(`Registered new user: ${username} for code ${code}`)

    socket.data.userid = userid
    socket.data.username = username
    socket.data.admin = false
    socket.data.usernameChanged = false
    next()
  }
  else {
    // login code is valid
    log.debug(`Invalid login code: ${code}`)
    socket.data
    next(new Error(`Invalid login code: ${code}`))
  }

}
