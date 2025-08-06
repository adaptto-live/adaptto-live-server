import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleAdminStatistics } from '../../../socket/admin/statistics'
import { 
  LoginCodeModel, 
  MessageModel, 
  QAEntryModel, 
  TalkRatingModel, 
  UserModel 
} from '../../../repository/mongodb.schema'
import { SocketData } from '../../../socket/socket.server.types'
import executeSocketHandler from '../../helper/executeSocketHandler'

describe('Admin Statistics Handler', () => {
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
    await LoginCodeModel.deleteMany({})
    await UserModel.deleteMany({})
    await TalkRatingModel.deleteMany({})
    await MessageModel.deleteMany({})
    await QAEntryModel.deleteMany({})
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

  // Test case 1: Should register adminGetStatistics event handler for admin user
  test('should register adminGetStatistics event handler for admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleAdminStatistics(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetStatistics', expect.any(Function))
  })

  // Test case 2: Should register adminGetStatistics event handler for QA admin user
  test('should register adminGetStatistics event handler for QA admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })

    // Act
    await handleAdminStatistics(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetStatistics', expect.any(Function))
  })

  // Test case 3: Should NOT register adminGetStatistics event handler for regular user
  test('should NOT register adminGetStatistics event handler for regular user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })

    // Act
    await handleAdminStatistics(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should emit statistics with correct counts
  test('should emit statistics with correct counts', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    // Create test data
    // 2 users
    await UserModel.create({
      _id: uuidv4(),
      username: 'user1',
      code: 'code1',
      created: new Date()
    })
    
    await UserModel.create({
      _id: uuidv4(),
      username: 'user2',
      code: 'code2',
      created: new Date()
    })
    
    // 3 login codes
    await LoginCodeModel.create({
      code: 'code1',
      userid: uuidv4(),
      used: new Date()
    })
    
    await LoginCodeModel.create({
      code: 'code2',
      userid: uuidv4(),
      used: null
    })
    
    await LoginCodeModel.create({
      code: 'code3',
      userid: uuidv4(),
      used: null
    })
    
    // 1 talk rating
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      userid: 'user-1',
      rating: 5,
      comment: 'Great talk',
      created: new Date()
    })
    
    // 2 messages
    await MessageModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-1',
      username: 'User One',
      text: 'Message 1'
    })
    
    await MessageModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-2',
      username: 'User Two',
      text: 'Message 2'
    })
    
    // 4 QA entries
    await QAEntryModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-1',
      username: 'User One',
      text: 'Question 1',
      entryIndex: 1
    })
    
    await QAEntryModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-2',
      username: 'User Two',
      text: 'Question 2',
      entryIndex: 2
    })
    
    await QAEntryModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-1',
      username: 'User One',
      text: 'Question 3',
      entryIndex: 3
    })
    
    await QAEntryModel.create({
      _id: uuidv4(),
      talkId: 'talk-1',
      date: new Date(),
      userid: 'user-2',
      username: 'User Two',
      text: 'Answer to Question 1',
      replyTo: 'question-1-id'
    })
    
    // Act
    await handleAdminStatistics(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminStatistics, 
      'adminGetStatistics', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminStatistics', {
      numLoginCodes: 3,
      numUsers: 2,
      numTalkRatings: 1,
      numMessages: 2,
      numQAEntries: 4
    })
  })

  // Test case 5: Should emit statistics with zero counts when no data exists
  test('should emit statistics with zero counts when no data exists', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    // Act
    await handleAdminStatistics(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminStatistics, 
      'adminGetStatistics', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminStatistics', {
      numLoginCodes: 0,
      numUsers: 0,
      numTalkRatings: 0,
      numMessages: 0,
      numQAEntries: 0
    })
  })
})
