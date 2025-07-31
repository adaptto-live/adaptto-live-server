import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleAdminTalkRatings } from '../../../socket/admin/talkRatings'
import { TalkRatingModel } from '../../../repository/mongodb.schema'
import { SocketData } from '../../../socket/socket.server.types'
import executeSocketHandler from '../../helper/executeSocketHandler'

describe('Admin Talk Ratings Handler', () => {
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

  // Test case 1: Should register adminGetTalkRatings event handler for admin user
  test('should register adminGetTalkRatings event handler for admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleAdminTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetTalkRatings', expect.any(Function))
  })

  // Test case 2: Should register adminGetTalkRatings event handler for QA admin user
  test('should register adminGetTalkRatings event handler for QA admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })

    // Act
    await handleAdminTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetTalkRatings', expect.any(Function))
  })

  // Test case 3: Should NOT register adminGetTalkRatings event handler for regular user
  test('should NOT register adminGetTalkRatings event handler for regular user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })

    // Act
    await handleAdminTalkRatings(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should emit aggregated talk ratings
  test('should emit aggregated talk ratings', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const talkId1 = 'talk-1'
    const talkId2 = 'talk-2'
    
    // Create test ratings for talk 1
    // User 1 - Rating 5 with comment
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: talkId1,
      userid: 'user-1',
      rating: 5,
      comment: 'Excellent presentation',
      created: new Date()
    })
    
    // User 2 - Rating 4 with comment
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: talkId1,
      userid: 'user-2',
      rating: 4,
      comment: 'Good content',
      created: new Date()
    })
    
    // User 3 - Rating 3 without comment
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: talkId1,
      userid: 'user-3',
      rating: 3,
      created: new Date()
    })
    
    // Create test ratings for talk 2
    // User 1 - Rating 5 without comment
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: talkId2,
      userid: 'user-1',
      rating: 5,
      created: new Date()
    })
    
    // User 2 - Rating 5 with comment
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: talkId2,
      userid: 'user-2',
      rating: 5,
      comment: 'Loved it!',
      created: new Date()
    })
    
    // Act
    await handleAdminTalkRatings(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminTalkRatings, 
      'adminGetTalkRatings', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminTalkRatings', expect.arrayContaining([
      expect.objectContaining({
        talkId: talkId1,
        averageRating: 4, // (5 + 4 + 3) / 3 = 4
        participants: 3,
        comments: expect.arrayContaining(['Excellent presentation', 'Good content'])
      }),
      expect.objectContaining({
        talkId: talkId2,
        averageRating: 5, // (5 + 5) / 2 = 5
        participants: 2,
        comments: ['Loved it!']
      })
    ]))
  })

  // Test case 5: Should emit empty results when no ratings exist
  test('should emit empty results when no ratings exist', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    // Act
    await handleAdminTalkRatings(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminTalkRatings, 
      'adminGetTalkRatings', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminTalkRatings', [])
  })

  // Test case 6: Should handle empty comments properly
  test('should handle empty comments properly', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const talkId = 'talk-with-empty-comments'
    
    // Create test ratings with empty comments
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: 'user-1',
      rating: 4,
      comment: '', // Empty comment
      created: new Date()
    })
    
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: 'user-2',
      rating: 3,
      comment: '   ', // Whitespace-only comment
      created: new Date()
    })
    
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: 'user-3',
      rating: 5,
      comment: 'Valid comment', // Valid comment
      created: new Date()
    })
    
    // Act
    await handleAdminTalkRatings(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminTalkRatings, 
      'adminGetTalkRatings', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminTalkRatings', [
      expect.objectContaining({
        talkId,
        averageRating: 4, // (4 + 3 + 5) / 3 = 4
        participants: 3,
        comments: ['Valid comment'] // Empty comments should be filtered out
      })
    ])
  })
})
