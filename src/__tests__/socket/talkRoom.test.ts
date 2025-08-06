import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleTalkRoom } from '../../socket/talkRoom'
import { 
  MessageModel,
  QAEntryModel,
  QAEntryLikeModel,
  TalkModeratorNotesModel 
} from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Talk Room Handler', () => {
  let mongoServer: MongoMemoryServer

  // Set up in-memory MongoDB before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  })

  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  // Reset database before each test
  beforeEach(async () => {
    await MessageModel.deleteMany({})
    await QAEntryModel.deleteMany({})
    await QAEntryLikeModel.deleteMany({})
    await TalkModeratorNotesModel.deleteMany({})
    jest.clearAllMocks()
  })

  // Helper to create a mock io server
  function createMockIo() {
    return {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    }
  }

  // Helper to create a mock socket
  function createMockSocket(data: Partial<SocketData> = {}) {
    return {
      data: {
        userid: 'test-user-id',
        username: 'testUser',
        admin: false,
        qaadmin: false,
        usernameChanged: false,
        ...data
      },
      emit: jest.fn(),
      on: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined)
    }
  }

  // Test case 1: Should join room and emit room users
  test('should join room and emit room users on roomEnter', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket()
    const talkId = 'test-talk-123'
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    // Execute the roomEnter handler
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.join).toHaveBeenCalledWith(talkId)
    expect(mockIo.to).toHaveBeenCalledWith(talkId)
    expect(mockIo.emit).toHaveBeenCalledWith('roomUsers', ['testUser'])
  })

  // Test case 2: Should emit existing messages on room enter if they exist
  test('should emit existing messages on room enter if they exist', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket()
    const talkId = 'test-talk-123'
    
    // Create test messages
    const message1 = {
      _id: uuidv4(),
      talkId,
      userid: 'user-1',
      username: 'User One',
      text: 'Hello',
      date: new Date(),
      highlight: false
    }
    
    const message2 = {
      _id: uuidv4(),
      talkId,
      userid: 'user-2',
      username: 'User Two',
      text: 'Hi there',
      date: new Date(Date.now() + 1000), // 1 second later
      highlight: true
    }
    
    await MessageModel.create(message1)
    await MessageModel.create(message2)
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('messages', expect.arrayContaining([
      expect.objectContaining({
        userid: 'user-1',
        username: 'User One',
        text: 'Hello',
        highlight: false
      }),
      expect.objectContaining({
        userid: 'user-2',
        username: 'User Two',
        text: 'Hi there',
        highlight: true
      })
    ]))
  })

  // Test case 3: Should emit existing QA entries on room enter if they exist
  test('should emit existing QA entries on room enter if they exist', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket()
    const talkId = 'test-talk-123'
    
    // Create test QA entries
    const qaEntry1 = {
      _id: 'qa-entry-1',
      id: 'qa-entry-1',
      talkId,
      userid: 'user-1',
      username: 'User One',
      text: 'First question',
      date: new Date(),
      entryIndex: 1,
      highlight: false,
      answered: false
    }
    
    const qaEntry2 = {
      _id: 'qa-entry-2',
      id: 'qa-entry-2',
      talkId,
      userid: 'user-2',
      username: 'User Two',
      text: 'Second question',
      date: new Date(Date.now() + 1000), // 1 second later
      entryIndex: 2,
      replyTo: 'qa-entry-1',
      highlight: true,
      answered: true
    }
    
    await QAEntryModel.create(qaEntry1)
    await QAEntryModel.create(qaEntry2)
    
    // Create a like for the first QA entry
    await QAEntryLikeModel.create({
      _id: uuidv4(),
      talkId,
      qaEntryId: 'qa-entry-1',
      userid: 'liker-user-id'
    })
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('qaEntries', expect.arrayContaining([
      expect.objectContaining({
        id: 'qa-entry-1',
        text: 'First question',
        likeUserIds: expect.arrayContaining(['liker-user-id'])
      }),
      expect.objectContaining({
        id: 'qa-entry-2',
        text: 'Second question',
        replyTo: 'qa-entry-1',
        likeUserIds: expect.any(Array)
      })
    ]))
  })

  // Test case 4: Should emit moderator notes for QA admins
  test('should emit moderator notes for QA admins', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket({ qaadmin: true })
    const talkId = 'test-talk-123'
    
    // Create test moderator notes
    await TalkModeratorNotesModel.create({
      _id: uuidv4(),
      talkId,
      text: 'Important note for moderators',
      updated: new Date()
    })
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('talkModeratorNotes', expect.objectContaining({
      text: 'Important note for moderators'
    }))
  })
  
  // Test case 5: Should emit moderator notes for admins
  test('should emit moderator notes for admins', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket({ admin: true })
    const talkId = 'test-talk-123'
    
    // Create test moderator notes
    await TalkModeratorNotesModel.create({
      _id: uuidv4(),
      talkId,
      text: 'Important note for moderators',
      updated: new Date()
    })
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('talkModeratorNotes', expect.objectContaining({
      text: 'Important note for moderators'
    }))
  })

  // Test case 6: Should NOT emit moderator notes for regular users
  test('should NOT emit moderator notes for regular users', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })
    const talkId = 'test-talk-123'
    
    // Create test moderator notes
    await TalkModeratorNotesModel.create({
      _id: uuidv4(),
      talkId,
      text: 'Important note for moderators',
      updated: new Date()
    })
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )
    
    // Assert - should not have been called with talkModeratorNotes
    expect(mockSocket.emit).not.toHaveBeenCalledWith(
      'talkModeratorNotes', 
      expect.anything()
    )
  })

  // Test case 7: Should leave room on roomLeave event
  test('should leave room on roomLeave event', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket()
    const talkId = 'test-talk-123'
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomLeave', 
      [talkId]
    )
    
    // Assert
    expect(mockSocket.leave).toHaveBeenCalledWith(talkId)
    expect(mockIo.to).toHaveBeenCalledWith(talkId)
    expect(mockIo.emit).toHaveBeenCalledWith('roomUsers', [])
  })

  // Test case 8: Should handle disconnect event
  test('should handle disconnect event', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket()
    const talkId = 'test-talk-123'
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    // enter room
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'roomEnter', 
      [talkId]
    )

    // disconnect
    await executeSocketHandler(
      mockSocket as any, 
      (socket) => Promise.resolve(handleTalkRoom(mockIo as any, socket as any)), 
      'disconnect', 
      []
    )
    
    // Assert
    expect(mockIo.emit).toHaveBeenCalledWith('roomUsers', [])
  })

  // Test case 9: Should not register any handlers if user data is incomplete
  test('should not register any handlers if user data is incomplete', async () => {
    // Arrange
    const mockIo = createMockIo()
    const mockSocket = createMockSocket({ 
      userid: '', // Empty userid
      username: 'testUser' 
    })
    
    // Act
    await handleTalkRoom(mockIo as any, mockSocket as any)
    
    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })
})
