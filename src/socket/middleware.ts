import { Socket } from 'socket.io'
import log from '../util/log'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { ExtendedError } from 'socket.io/dist/namespace'
import { LoginCodeModel, UserModel } from '../repository/mongodb.schema'
import { v4 as uuidv4 } from 'uuid'
import { loginTokenUsernameValidation } from '../repository/validation.schema'

// this is executed when a new Websocket connection is created
export async function middleware(
    socket: Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    next: (err?: ExtendedError) => void) {

  // validate presence of valid login code and username
  const { error } = loginTokenUsernameValidation.validate(socket.handshake.auth)
  if (error) {
    log.debug(`Reject request with invalid authorization: ${error}`)
    next(new Error(`Authorization rejected: ${error}`))
    return
  }
  const { code, username } = socket.handshake.auth

  // check fo existing user for this login code
  const user = await UserModel.findOne({code}).exec()
  if (user) {
    if (user.blocked) {
      // reject connection if user is blocked
      log.debug(`Reject blocked user: ${username}, code ${code}`)
      next(new Error(`User is blocked.`))
      return
    }
    else {
      // allow existing user
      socket.data.userid = user._id
      socket.data.username = username
      socket.data.admin = user.admin
      socket.data.usernameChanged = (user.username != username)
      next()
      return
    }
  }

  // check logincode to register a new user
  const loginCode = await LoginCodeModel.findOne({code,userid:null}).exec()
  if (loginCode) {
    // create new user for valid login code
    const userid = uuidv4()
    await UserModel.create({_id:userid, code, username, created: new Date()})
    loginCode.userid = userid
    loginCode.used = new Date()
    await loginCode.save()
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
    next(new Error(`Invalid login code: ${code}`))
  }

}
