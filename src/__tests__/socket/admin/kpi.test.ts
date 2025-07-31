import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleAdminKPI } from '../../../socket/admin/kpi'
import { MessageModel, QAEntryModel, TalkRatingModel, UserModel } from '../../../repository/mongodb.schema'
import { SocketData } from '../../../socket/socket.server.types'
import executeSocketHandler from '../../helper/executeSocketHandler'

describe('Admin KPI Handler', () => {
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
    await UserModel.deleteMany({})
    await MessageModel.deleteMany({})
    await QAEntryModel.deleteMany({})
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

  // Test case 1: Should register adminGetKPI event handler for admin user
  test('should register adminGetKPI event handler for admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleAdminKPI(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetKPI', expect.any(Function))
  })

  // Test case 2: Should register adminGetKPI event handler for QA admin user
  test('should register adminGetKPI event handler for QA admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ qaadmin: true })

    // Act
    await handleAdminKPI(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetKPI', expect.any(Function))
  })

  // Test case 3: Should NOT register adminGetKPI event handler for regular user
  test('should NOT register adminGetKPI event handler for regular user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false, qaadmin: false })

    // Act
    await handleAdminKPI(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should emit user registration KPI data
  test('should emit user registration KPI data', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Create test users with different registration times
    await UserModel.create({
      _id: uuidv4(),
      username: 'user1',
      code: 'code1',
      created: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15, 0) // Today 10:15 AM
    })
    
    await UserModel.create({
      _id: uuidv4(),
      username: 'user2',
      code: 'code2',
      created: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 11, 45, 0) // Yesterday 11:45 AM
    })
    
    await UserModel.create({
      _id: uuidv4(),
      username: 'user3',
      code: 'code3',
      created: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30, 0) // Today 2:30 PM
    })
    
    // Act
    await handleAdminKPI(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminKPI, 
      'adminGetKPI', 
      [[yesterday, today]]
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminKPIDataset', expect.objectContaining({
      title: 'User Registrations',
      xAxisTitle: 'Hour of day',
      yAxisTitle: '# Registrations',
      days: expect.arrayContaining([
        expect.objectContaining({
          day: 1, // First day (yesterday)
          values: expect.any(Array)
        }),
        expect.objectContaining({
          day: 2, // Second day (today)
          values: expect.any(Array)
        })
      ])
    }))
  })

  // Test case 5: Should emit user activity KPI data
  test('should emit user activity KPI data', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const talkId = 'test-talk-123'
    
    // Create test messages
    await MessageModel.create({
      _id: uuidv4(),
      talkId,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 15, 0), // Today 10:15 AM
      userid: 'user1',
      username: 'user1',
      text: 'Message 1'
    })
    
    // Create test QA entries
    await QAEntryModel.create({
      _id: uuidv4(),
      talkId,
      date: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 11, 45, 0), // Yesterday 11:45 AM
      userid: 'user2',
      username: 'user2',
      text: 'QA Entry 1',
      entryIndex: 1
    })
    
    // Create test talk ratings
    await TalkRatingModel.create({
      _id: uuidv4(),
      talkId,
      userid: 'user3',
      rating: 5,
      created: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30, 0) // Today 2:30 PM
    })
    
    // Act
    await handleAdminKPI(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminKPI, 
      'adminGetKPI', 
      [[yesterday, today]]
    )
    
    // Assert - should emit both datasets
    expect(mockSocket.emit).toHaveBeenCalledTimes(2)
    
    // Check for the user activity dataset
    expect(mockSocket.emit).toHaveBeenCalledWith('adminKPIDataset', expect.objectContaining({
      title: 'User Activity',
      xAxisTitle: 'Hour of day',
      yAxisTitle: '# Messages / Q&A Entries / Ratings',
      days: expect.arrayContaining([
        expect.objectContaining({
          day: 1, // First day (yesterday)
          values: expect.any(Array)
        }),
        expect.objectContaining({
          day: 2, // Second day (today)
          values: expect.any(Array)
        })
      ])
    }))
  })
})
