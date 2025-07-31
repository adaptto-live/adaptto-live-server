import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleTalkRoomMessages } from '../../socket/talkRoomMessages'
import { MessageModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Talk Room Messages Handler', () => {
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
    jest.clearAllMocks()
  })

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
      in: jest.fn().mockReturnThis(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined)
    }
  }

  // Test case 1: Should register message event handlers
  test('should register message event handlers', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleTalkRoomMessages(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('messageUpdate', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('messageDelete', expect.any(Function))
  })

  // Test case 2: Should not register handlers if user data is incomplete
  test('should not register handlers if user data is incomplete', async () => {
    // Arrange
    const mockSocket = createMockSocket({ 
      userid: '', // Empty userid
      username: 'testUser'
    })

    // Act
    await handleTalkRoomMessages(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 3: Should create a new message
  test('should create a new message', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    const text = 'Hello, everyone!'
    const mockCallback = jest.fn()
    
    const newMessage = {
      id: messageId,
      talkId,
      text,
      highlight: false
    }
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'message', 
      [newMessage, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify message was stored in database
    const storedMessage = await MessageModel.findById(messageId).exec()
    expect(storedMessage).not.toBeNull()
    expect(storedMessage?.text).toBe(text)
    expect(storedMessage?.talkId).toBe(talkId)
    expect(storedMessage?.userid).toBe('test-user-id')
    expect(storedMessage?.username).toBe('testUser')
    
    // Verify message was broadcast to room
    expect(mockSocket.in).toHaveBeenCalledWith(talkId)
    expect(mockSocket.emit).toHaveBeenCalledWith('messages', [
      expect.objectContaining({
        id: messageId,
        text,
        userid: 'test-user-id',
        username: 'testUser'
      })
    ])
  })

  // Test case 4: Should validate new message input
  test('should validate new message input', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const mockCallback = jest.fn()
    
    // Invalid message (missing required fields)
    const invalidMessage = {
      text: 'Hello, everyone!'
      // Missing id and talkId
    }
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'message', 
      [invalidMessage, mockCallback]
    )
    
    // Assert - isInputValid will handle validation failure and call callback with error
    expect(mockCallback).not.toHaveBeenCalledWith({ success: true })
    
    // No message should be stored
    const count = await MessageModel.countDocuments().exec()
    expect(count).toBe(0)
  })

  // Test case 5: Should update an existing message
  test('should update an existing message', async () => {
    // Arrange
    const userId = 'test-user-id'
    const username = 'testUser'
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a message first
    await MessageModel.create({
      _id: messageId,
      talkId,
      date: new Date(),
      userid: userId,
      username,
      text: 'Original message',
      highlight: false
    })
    
    const mockSocket = createMockSocket({ userid: userId, username })
    const mockCallback = jest.fn()
    
    const updatedMessage = {
      id: messageId,
      talkId,
      text: 'Updated message',
      highlight: true
    }
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'messageUpdate', 
      [updatedMessage, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify message was updated in database
    const storedMessage = await MessageModel.findById(messageId).exec()
    expect(storedMessage?.text).toBe('Updated message')
    expect(storedMessage?.highlight).toBe(true)
    
    // Verify update was broadcast to room
    expect(mockSocket.in).toHaveBeenCalledWith(talkId)
    expect(mockSocket.emit).toHaveBeenCalledWith('messageUpdate', expect.objectContaining({
      id: messageId,
      text: 'Updated message',
      highlight: true
    }))
  })

  // Test case 6: Should not update message owned by another user unless admin
  test('should not update message owned by another user unless admin', async () => {
    // Arrange
    const ownerId = 'message-owner-id'
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a message owned by someone else
    await MessageModel.create({
      _id: messageId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'messageOwner',
      text: 'Original message',
      highlight: false
    })
    
    // Non-admin user trying to update someone else's message
    const mockSocket = createMockSocket({ 
      userid: 'different-user-id',
      username: 'differentUser',
      admin: false
    })
    
    const mockCallback = jest.fn()
    
    const updatedMessage = {
      id: messageId,
      talkId,
      text: 'Attempted update by non-owner',
      highlight: true
    }
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'messageUpdate', 
      [updatedMessage, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ 
      success: false,
      error: expect.stringContaining('not found or not allowed')
    }))
    
    // Verify message was NOT updated in database
    const storedMessage = await MessageModel.findById(messageId).exec()
    expect(storedMessage?.text).toBe('Original message')
    expect(storedMessage?.highlight).toBe(false)
  })

  // Test case 7: Should allow admin to update any message
  test('should allow admin to update any message', async () => {
    // Arrange
    const ownerId = 'message-owner-id'
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a message owned by someone else
    await MessageModel.create({
      _id: messageId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'messageOwner',
      text: 'Original message',
      highlight: false
    })
    
    // Admin user trying to update someone else's message
    const mockSocket = createMockSocket({ 
      userid: 'admin-user-id',
      username: 'adminUser',
      admin: true
    })
    
    const mockCallback = jest.fn()
    
    const updatedMessage = {
      id: messageId,
      talkId,
      text: 'Admin updated message',
      highlight: true
    }
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'messageUpdate', 
      [updatedMessage, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify message was updated in database
    const storedMessage = await MessageModel.findById(messageId).exec()
    expect(storedMessage?.text).toBe('Admin updated message')
    expect(storedMessage?.highlight).toBe(true)
  })

  // Test case 8: Should delete a message
  test('should delete a message', async () => {
    // Arrange
    const userId = 'test-user-id'
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a message first
    await MessageModel.create({
      _id: messageId,
      talkId,
      date: new Date(),
      userid: userId,
      username: 'testUser',
      text: 'Message to be deleted',
      highlight: false
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'messageDelete', 
      [messageId, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify message was deleted from database
    const deletedMessage = await MessageModel.findById(messageId).exec()
    expect(deletedMessage).toBeNull()
    
    // Verify deletion was broadcast to room
    expect(mockSocket.in).toHaveBeenCalledWith(talkId)
    expect(mockSocket.emit).toHaveBeenCalledWith('messageDelete', messageId)
  })

  // Test case 9: Should not delete message owned by another user unless admin
  test('should not delete message owned by another user unless admin', async () => {
    // Arrange
    const ownerId = 'message-owner-id'
    const messageId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a message owned by someone else
    await MessageModel.create({
      _id: messageId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'messageOwner',
      text: 'Message that should not be deleted',
      highlight: false
    })
    
    // Non-admin user trying to delete someone else's message
    const mockSocket = createMockSocket({ 
      userid: 'different-user-id',
      username: 'differentUser',
      admin: false
    })
    
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomMessages(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomMessages, 
      'messageDelete', 
      [messageId, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ 
      success: false,
      error: expect.stringContaining('not found or not allowed')
    }))
    
    // Verify message was NOT deleted from database
    const storedMessage = await MessageModel.findById(messageId).exec()
    expect(storedMessage).not.toBeNull()
  })
})
