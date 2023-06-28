import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import { config } from 'dotenv'
import log from './util/log'
import { ClientToServerEvents, ServerToClientEvents } from './socket/socket.types'
import { InterServerEvents, SocketData } from './socket/socket.server.types'
import { middleware } from './socket/middleware'
import { handleConnection } from './socket/connection'
import { handleTalkRatings } from './socket/talkRatings'
import { handleTalkRoom } from './socket/talkRoom'
import { handleCurrentTalk } from './socket/currentTalk'
import { handleAdminUserManagement } from './socket/admin/userManagement'
import { handleAdminTalkRatings } from './socket/admin/talkRatings'
import { handleAdminStatistics } from './socket/admin/statistics'
import { version} from '../package.json'
import { handleTalkRoomMessages } from './socket/talkRoomMessages'
import { handleTalkRoomQAEntries } from './socket/talkRoomQAEntries'
import { handleAdminLoginCodeManagement } from './socket/admin/loginCodeManagement'

// read env configuration
config()

const app = express()
const server = createServer(app)
const io = new Server<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>(server, {
  cors: {
    origin: process.env.APPSETTING_CORS_ORIGIN
  }
})

process.on('uncaughtException', err => {
  log.error(err)
})

app.get('/', (req, res) => {
  res.contentType('text/plain')
  res.send(`adaptTo() Live Server ${version}`);
});

io.use(middleware)
io.on('connection', async (socket) => {
  await handleConnection(socket)
  await handleCurrentTalk(socket)
  await handleTalkRatings(socket)
  await handleTalkRoom(io, socket)
  await handleTalkRoomMessages(socket)
  await handleTalkRoomQAEntries(socket)
  await handleAdminLoginCodeManagement(socket)
  await handleAdminUserManagement(socket)
  await handleAdminTalkRatings(socket)
  await handleAdminStatistics(socket)
})

async function run() {
  await mongoose.connect(process.env.APPSETTING_DATABASE_URL ?? '')
  log.info(`Connected to ${process.env.APPSETTING_DATABASE_URL}`)

  server.listen(process.env.PORT, () => {
    log.info(`Running at localhost:${process.env.PORT}`)
  })  
}
run().catch(err => log.error(err))
