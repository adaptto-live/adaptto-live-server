import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import { LoginCodeModel } from '../../repository/mongodb.schema'

export async function handleAdminLoginCodeManagement(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin } = socket.data

  // admin-only operations
  if (!admin) {
    return
  }

  socket.on('adminGetLoginCodes', async () => {
    log.debug('Admin: get login codes')
    const codes = await LoginCodeModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userid',
          foreignField: '_id',
          as: 'user'
        }
      }
    ]).sort({used:-1, code:1}).exec()
    socket.emit('adminLoginCodes', codes.map(code => 
        ({code: code.code, userid: code.userid, username: code.user[0]?.username, used: code.used})))
  })

}
