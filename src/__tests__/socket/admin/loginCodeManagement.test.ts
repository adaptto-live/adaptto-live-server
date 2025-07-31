import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleAdminLoginCodeManagement } from '../../../socket/admin/loginCodeManagement'
import { LoginCodeModel, UserModel } from '../../../repository/mongodb.schema'
import { SocketData } from '../../../socket/socket.server.types'
import executeSocketHandler from '../../helper/executeSocketHandler'

describe('Admin Login Code Management Handler', () => {
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

  // Test case 1: Should register adminGetLoginCodes event handler for admin user
  test('should register adminGetLoginCodes event handler for admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleAdminLoginCodeManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetLoginCodes', expect.any(Function))
  })

  // Test case 2: Should NOT register adminGetLoginCodes event handler for non-admin user
  test('should NOT register adminGetLoginCodes event handler for non-admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false })

    // Act
    await handleAdminLoginCodeManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 3: Should NOT register adminGetLoginCodes event handler for QA admin user
  test('should NOT register adminGetLoginCodes event handler for QA admin user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ 
      admin: false,
      qaadmin: true
    })

    // Act
    await handleAdminLoginCodeManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should emit login codes to admin
  test('should emit login codes to admin', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const userId1 = uuidv4()
    const userId2 = uuidv4()
    
    // Create test users
    await UserModel.create({
      _id: userId1,
      username: 'user1',
      code: 'code1',
      created: new Date()
    })
    
    await UserModel.create({
      _id: userId2,
      username: 'user2',
      code: 'code2',
      created: new Date()
    })
    
    // Create test login codes
    await LoginCodeModel.create({
      code: 'ABC123',
      userid: userId1,
      used: new Date()
    })
    
    await LoginCodeModel.create({
      code: 'DEF456',
      userid: userId2,
      used: null
    })
    
    // Act
    await handleAdminLoginCodeManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminLoginCodeManagement, 
      'adminGetLoginCodes', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminLoginCodes', expect.arrayContaining([
      expect.objectContaining({
        code: 'ABC123',
        userid: userId1,
        username: 'user1',
        used: expect.any(Date)
      }),
      expect.objectContaining({
        code: 'DEF456',
        userid: userId2,
        username: 'user2',
        used: null
      })
    ]))
  })

  // Test case 5: Should handle case when user doesn't exist for a code
  test('should handle case when user doesn\'t exist for a code', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    const nonExistentUserId = uuidv4()
    
    // Create test login code with non-existent user
    await LoginCodeModel.create({
      code: 'XYZ789',
      userid: nonExistentUserId,
      used: null
    })
    
    // Act
    await handleAdminLoginCodeManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminLoginCodeManagement, 
      'adminGetLoginCodes', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminLoginCodes', expect.arrayContaining([
      expect.objectContaining({
        code: 'XYZ789',
        userid: nonExistentUserId,
        username: undefined,
        used: null
      })
    ]))
  })
})
