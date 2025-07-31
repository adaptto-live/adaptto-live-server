import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleCurrentTalk } from '../../socket/currentTalk'
import { CurrentTalkModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Current Talk Handler', () => {
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
    await CurrentTalkModel.deleteMany({})
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
      broadcast: {
        emit: jest.fn()
      }
    }
  }

  // Test case 1: Should emit current talk on login if one exists
  test('should emit current talk on login if one exists', async () => {
    // Arrange
    const talkId = 'test-talk-123'
    await CurrentTalkModel.create({
      _id: uuidv4(),
      talkId,
      created: new Date()
    })
    
    const mockSocket = createMockSocket()

    // Act
    await handleCurrentTalk(mockSocket as any)

    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('currentTalk', talkId)
  })

  // Test case 2: Should not emit current talk on login if none exists
  test('should not emit current talk on login if none exists', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleCurrentTalk(mockSocket as any)

    // Assert
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  // Test case 3: Should register currentTalk event handler for admin users
  test('should register currentTalk event handler for admin users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleCurrentTalk(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('currentTalk', expect.any(Function))
  })

  // Test case 4: Should register currentTalk event handler for qaadmin users
  test('should register currentTalk event handler for qaadmin users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })

    // Act
    await handleCurrentTalk(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('currentTalk', expect.any(Function))
  })

  // Test case 5: Should NOT register currentTalk event handler for regular users
  test('should not register currentTalk event handler for regular users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })

    // Act
    await handleCurrentTalk(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 6: Should update current talk when admin changes it
  test('should update current talk when admin changes it', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    const newTalkId = 'new-talk-456'
    const mockCallback = jest.fn()
    
    // Use the utility method to execute the handler and wait for completion
    await executeSocketHandler(
      mockSocket as any, 
      handleCurrentTalk, 
      'currentTalk', 
      [newTalkId, mockCallback]
    )
    
    // Assert results after handler execution
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('currentTalk', newTalkId)
    
    // Verify database was updated
    const currentTalk = await CurrentTalkModel.findOne().exec()
    expect(currentTalk).not.toBeNull()
    expect(currentTalk?.talkId).toBe(newTalkId)
  })

  // Test case 7: Should validate input when changing current talk
  test('should validate input when changing current talk', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    const invalidTalkId = '$#!%'
    const mockCallback = jest.fn()
    
    // Use the utility method to execute the handler and wait for completion
    await executeSocketHandler(
      mockSocket as any, 
      handleCurrentTalk, 
      'currentTalk', 
      [invalidTalkId, mockCallback]
    )
    
    // Assert results after handler execution
    expect(mockSocket.broadcast.emit).not.toHaveBeenCalled()
    
    // Verify database was not updated
    const currentTalk = await CurrentTalkModel.findOne().exec()
    expect(currentTalk).toBeNull()
  })
})
