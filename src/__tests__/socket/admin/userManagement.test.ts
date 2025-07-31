import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleAdminUserManagement } from '../../../socket/admin/userManagement'
import { UserModel } from '../../../repository/mongodb.schema'
import { SocketData } from '../../../socket/socket.server.types'
import executeSocketHandler from '../../helper/executeSocketHandler'

describe('Admin User Management Handler', () => {
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

  // Test case 1: Should register admin event handlers for admin users
  test('should register admin event handlers for admin users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })

    // Act
    await handleAdminUserManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('adminGetUsers', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('adminUpdateUser', expect.any(Function))
  })

  // Test case 2: Should NOT register admin event handlers for non-admin users
  test('should NOT register admin event handlers for non-admin users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: false })

    // Act
    await handleAdminUserManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 3: Should NOT register admin event handlers for QA admin users
  test('should NOT register admin event handlers for QA admin users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ 
      admin: false,
      qaadmin: true
    })

    // Act
    await handleAdminUserManagement(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 4: Should emit list of users
  test('should emit list of users', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const user1Id = uuidv4()
    const user2Id = uuidv4()
    
    // Create test users
    await UserModel.create({
      _id: user1Id,
      code: 'code1',
      username: 'user1',
      admin: true,
      qaadmin: false,
      blocked: false,
      created: new Date(),
      updated: new Date()
    })
    
    await UserModel.create({
      _id: user2Id,
      code: 'code2',
      username: 'user2',
      admin: false,
      qaadmin: true,
      blocked: false,
      created: new Date(),
      updated: new Date()
    })
    
    // Act
    await handleAdminUserManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminUserManagement, 
      'adminGetUsers', 
      []
    )
    
    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('adminUsers', expect.arrayContaining([
      expect.objectContaining({
        id: user1Id,
        code: 'code1',
        username: 'user1',
        admin: true,
        qaadmin: false,
        blocked: false
      }),
      expect.objectContaining({
        id: user2Id,
        code: 'code2',
        username: 'user2',
        admin: false,
        qaadmin: true,
        blocked: false
      })
    ]))
  })

  // Test case 5: Should update user data
  test('should update user data', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const userId = uuidv4()
    
    // Create test user
    await UserModel.create({
      _id: userId,
      code: 'test-code',
      username: 'originalUsername',
      admin: false,
      qaadmin: false,
      blocked: false,
      created: new Date(),
      updated: new Date(Date.now() - 10000) // 10 seconds ago
    })
    
    const mockCallback = jest.fn()
    const updatedUserData = {
      id: userId,
      username: 'updatedUsername',
      admin: true,
      qaadmin: true,
      blocked: false
    }
    
    // Act
    await handleAdminUserManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminUserManagement, 
      'adminUpdateUser', 
      [updatedUserData, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Check that user was updated in database
    const updatedUser = await UserModel.findById(userId).exec()
    expect(updatedUser).not.toBeNull()
    expect(updatedUser?.username).toBe('updatedUsername')
    expect(updatedUser?.admin).toBe(true)
    expect(updatedUser?.qaadmin).toBe(true)
    expect(updatedUser?.blocked).toBe(false)
  })

  // Test case 6: Should block a user
  test('should block a user and emit userBlocked event', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const userId = uuidv4()
    
    // Create test user
    await UserModel.create({
      _id: userId,
      code: 'test-code',
      username: 'testUser',
      admin: false,
      qaadmin: false,
      blocked: false,
      created: new Date(),
      updated: new Date()
    })
    
    const mockCallback = jest.fn()
    const updatedUserData = {
      id: userId,
      username: 'testUser', // Same username, no change
      admin: false,
      qaadmin: false,
      blocked: true // Block the user
    }
    
    // Act
    await handleAdminUserManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminUserManagement, 
      'adminUpdateUser', 
      [updatedUserData, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Check that user was blocked in database
    const updatedUser = await UserModel.findById(userId).exec()
    expect(updatedUser?.blocked).toBe(true)
    
    // Check that userBlocked event was broadcast
    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('userBlocked', userId)
  })

  // Test case 7: Should handle non-existent user
  test('should handle non-existent user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const nonExistentId = uuidv4()
    const mockCallback = jest.fn()
    
    const userData = {
      id: nonExistentId,
      username: 'nonExistentUser',
      admin: false,
      qaadmin: false,
      blocked: false
    }
    
    // Act
    await handleAdminUserManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminUserManagement, 
      'adminUpdateUser', 
      [userData, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('not found')
    }))
  })

  // Test case 8: Should validate input
  test('should validate input before updating user', async () => {
    // Arrange
    const mockSocket = createMockSocket({ admin: true })
    
    const userId = uuidv4()
    const mockCallback = jest.fn()
    
    // Invalid user data (missing required fields)
    const invalidUserData = {
      id: userId
      // Missing username and other required fields
    }
    
    // Act
    await handleAdminUserManagement(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleAdminUserManagement, 
      'adminUpdateUser', 
      [invalidUserData, mockCallback]
    )
    
    // Assert - isInputValid will handle validation failure
    expect(mockCallback).not.toHaveBeenCalledWith({ success: true })
  })
})
