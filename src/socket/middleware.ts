import { Socket } from 'socket.io'
import log from '../util/log'
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from './socket.types'
import { ExtendedError } from 'socket.io/dist/namespace'
import { UserModel } from '../repository/mongodb.schema'

// this is executed when a new Websocket connection is created
export async function middleware(
    socket: Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    next: (err?: ExtendedError) => void) : Promise<void> {

  // validate presence of a user name in middleware
  const username = socket.handshake.auth.username
  if (!username) {
    log.debug('Reject request without auth.username property.')
    next(new Error('Not authorized'))
  }
  else {
    const existingUser = await UserModel.findOne({username}).exec()
    // reject connection if user is blocked
    if (existingUser?.blocked) {
      log.debug(`Reject blocked user: ${username}`)
      next(new Error(`User '${username}' is blocked.`))
    }
    else {
      next()
    }
  }

}
