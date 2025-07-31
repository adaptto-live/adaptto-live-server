import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleTalkRoomModeratorNotes } from '../../socket/talkRoomModeratorNotes'
import { TalkModeratorNotesModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Talk Room Moderator Notes Handler', () => {
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
    await TalkModeratorNotesModel.deleteMany({})
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
      on: jest.fn()
    }
  }

  // Test case 1: Should register talkModeratorNotes event handler for admin user
  test('should register talkModeratorNotes event handler for admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('talkModeratorNotes', expect.any(Function))
  })

  // Test case 2: Should register talkModeratorNotes event handler for QA admin user
  test('should register talkModeratorNotes event handler for QA admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })

    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('talkModeratorNotes', expect.any(Function))
  })

  // Test case 3: Should NOT register talkModeratorNotes event handler for regular user
  test('should NOT register talkModeratorNotes event handler for regular user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })

    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should create new moderator notes when they don't exist
  test('should create new moderator notes when they don\'t exist', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    const talkId = 'test-talk-123'
    const mockCallback = jest.fn()
    
    const notes = {
      talkId,
      text: 'Important note for moderators'
    }
    
    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomModeratorNotes, 
      'talkModeratorNotes', 
      [notes, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify notes were stored in database
    const storedNotes = await TalkModeratorNotesModel.findOne({ talkId }).exec()
    expect(storedNotes).not.toBeNull()
    expect(storedNotes?.text).toBe('Important note for moderators')
    expect(storedNotes?.updated).toBeInstanceOf(Date)
  })

  // Test case 5: Should update existing moderator notes
  test('should update existing moderator notes', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    const talkId = 'test-talk-123'
    const noteId = uuidv4()
    
    // Create existing notes first
    await TalkModeratorNotesModel.create({
      _id: noteId,
      talkId,
      text: 'Original note',
      updated: new Date(Date.now() - 3600000) // 1 hour ago
    })
    
    const mockCallback = jest.fn()
    const updatedNotes = {
      talkId,
      text: 'Updated note for moderators'
    }
    
    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)
    
    const beforeUpdate = Date.now()
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomModeratorNotes, 
      'talkModeratorNotes', 
      [updatedNotes, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify notes were updated in database
    const storedNotes = await TalkModeratorNotesModel.findOne({ talkId }).exec()
    expect(storedNotes).not.toBeNull()
    expect(storedNotes?._id.toString()).toBe(noteId)
    expect(storedNotes?.text).toBe('Updated note for moderators')
    
    // Check that updated timestamp was refreshed
    const updatedTimestamp = storedNotes?.updated.getTime() || 0
    expect(updatedTimestamp).toBeGreaterThanOrEqual(beforeUpdate)
  })

  // Test case 6: Should validate input
  test('should validate input before storing notes', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })
    const mockCallback = jest.fn()
    
    // Invalid notes (missing talkId)
    const invalidNotes = { 
      text: 'Note with missing talkId'
    }
    
    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomModeratorNotes, 
      'talkModeratorNotes', 
      [invalidNotes, mockCallback]
    )
    
    // Assert - isInputValid will handle validation failure
    expect(mockCallback).not.toHaveBeenCalledWith({ success: true })
    
    // Verify no notes were stored
    const count = await TalkModeratorNotesModel.countDocuments().exec()
    expect(count).toBe(0)
  })

  // Test case 7: Should not process notes with incomplete user data
  test('should not process notes with incomplete user data', async () => {
    // Arrange
    const mockSocket = createMockSocket({ 
      userid: '', // Empty userid
      admin: true
    })
    
    // Act
    await handleTalkRoomModeratorNotes(mockSocket as any)
    
    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })
})
