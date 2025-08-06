import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleTalkRatings } from '../../socket/talkRatings'
import { TalkRatingModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Talk Ratings Handler', () => {
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
    await TalkRatingModel.deleteMany({})
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

  // Test case 1: Should emit existing talk ratings on login
  test('should emit existing talk ratings on login', async () => {
    // Arrange
    const userId = 'test-user-id'
    const talkId = 'test-talk-123'
    const rating = 4
    const comment = 'Great talk!'

    // Create a talk rating in the database
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: userId,
      rating,
      comment,
      created: new Date()
    })
    
    const mockSocket = createMockSocket({ userid: userId })

    // Act
    await handleTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('talkRatings', [
      { talkId, rating, comment }
    ])
  })

  // Test case 2: Should not emit talk ratings if none exist
  test('should not emit talk ratings if none exist', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  // Test case 3: Should register talkRating event handler
  test('should register talkRating event handler', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('talkRating', expect.any(Function))
  })

  // Test case 4: Should store new talk rating
  test('should store new talk rating', async () => {
    // Arrange
    const userId = 'test-user-id'
    const talkId = 'test-talk-456'
    const rating = 5
    const comment = 'Excellent presentation'
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    const talkRating = { talkId, rating, comment }
    
    // Act - Use the executeSocketHandler helper to test the handler
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRatings, 
      'talkRating', 
      [talkRating, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify the database was updated
    const savedRating = await TalkRatingModel.findOne({ talkId, userid: userId }).exec()
    expect(savedRating).not.toBeNull()
    expect(savedRating?.rating).toBe(rating)
    expect(savedRating?.comment).toBe(comment)
  })

  // Test case 5: Should delete talk rating when rating is falsy
  test('should delete talk rating when rating is falsy', async () => {
    // Arrange
    const userId = 'test-user-id'
    const talkId = 'test-talk-789'
    
    // Create an existing rating first
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: userId,
      rating: 3,
      comment: 'Good talk',
      created: new Date()
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    const talkRating = { talkId, rating: undefined } // missing rating means delete
    
    // Act
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRatings, 
      'talkRating', 
      [talkRating, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify the rating was deleted
    const deletedRating = await TalkRatingModel.findOne({ talkId, userid: userId }).exec()
    expect(deletedRating).toBeNull()
  })

  // Test case 6: Should validate input
  test('should validate input before storing rating', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const mockCallback = jest.fn()
    const invalidTalkRating = { rating: 5 } // Missing talkId
    
    // Act
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRatings, 
      'talkRating', 
      [invalidTalkRating, mockCallback]
    )
    
    // Assert - isInputValid will handle validation failure internally
    expect(mockCallback).not.toHaveBeenCalledWith({ success: true })
    
    // Database should not contain any entries
    const count = await TalkRatingModel.countDocuments().exec()
    expect(count).toBe(0)
  })
})
