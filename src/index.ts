import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import { config } from 'dotenv'
import log from './util/log'
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from './socket/socket.types'
import { middleware } from './socket/middleware'
import { handleConnection } from './socket/connection'
import { handleTalkRatings } from './socket/talkRatings'
import { handleTalkRoom } from './socket/talkRoom'
import { handleCurrentTalk } from './socket/currentTalk'
import { handleAdminUserManagement } from './socket/admin/userManagement'
import { handleAdminTalkRatings } from './socket/admin/talkRatings'
import { handleAdminStatistics } from './socket/admin/statistics'

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
  res.send('adaptTo() Live Server');
});

io.use(middleware)
io.on('connection', async (socket) => {
  const authenticationInfo = await handleConnection(socket)
  await handleCurrentTalk(socket, authenticationInfo)
  await handleTalkRatings(socket, authenticationInfo)
  await handleTalkRoom(io, socket, authenticationInfo)
  await handleAdminUserManagement(socket, authenticationInfo)
  await handleAdminTalkRatings(socket, authenticationInfo)
  await handleAdminStatistics(socket, authenticationInfo)
})

async function run() {
  await mongoose.connect(process.env.APPSETTING_DATABASE_URL ?? '')
  log.info(`Connected to ${process.env.APPSETTING_DATABASE_URL}`)

  server.listen(process.env.PORT, () => {
    log.info(`Running at localhost:${process.env.PORT}`)
  })  
}
run().catch(err => log.error(err))
