import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { middleware } from '../../socket/middleware'
import { LoginCodeModel, UserModel } from '../../repository/mongodb.schema'
import { ExtendedError } from 'socket.io/dist/namespace'
import { SocketData } from '../../socket/socket.server.types'

describe('Socket Middleware Authentication', () => {
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
  })

  // Mock socket.io
  function createMockSocket(authData: any) {
    return {
      handshake: {
        auth: authData
      },
      data: {} as SocketData
    }
  }

  // Mock next function for middleware
  function createMockNext() {
    return jest.fn() as jest.Mock & ((err?: ExtendedError) => void)
  }

  // Test case 1: Valid login code for new user
  test('should register new user with valid login code', async () => {
    // Arrange
    const loginCode = 'valid123'
    const username = 'testUser'
    
    // Create a valid login code in the database
    await LoginCodeModel.create({
      code: loginCode,
      userid: null
    })

    const mockSocket = createMockSocket({ code: loginCode, username })
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith()
    expect(mockSocket.data.username).toBe(username)
    expect(mockSocket.data.userid).toBeDefined()
    expect(mockSocket.data.admin).toBe(false)
    expect(mockSocket.data.qaadmin).toBe(false)
    expect(mockSocket.data.usernameChanged).toBe(false)

    // Verify database records were updated
    const updatedLoginCode = await LoginCodeModel.findOne({ code: loginCode })
    expect(updatedLoginCode?.userid).toBeDefined()
    expect(updatedLoginCode?.used).toBeInstanceOf(Date)

    const newUser = await UserModel.findOne({ code: loginCode })
    expect(newUser?.username).toBe(username)
  })

  // Test case 2: Existing user with valid login code
  test('should authenticate existing user', async () => {
    // Arrange
    const loginCode = 'valid456'
    const userId = uuidv4()
    const username = 'existingUser'
    
    // Create existing user in the database
    await UserModel.create({
      _id: userId,
      code: loginCode,
      username,
      admin: true,
      qaadmin: true,
      created: new Date()
    })

    const mockSocket = createMockSocket({ code: loginCode, username })
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith()
    expect(mockSocket.data.username).toBe(username)
    expect(mockSocket.data.userid).toBe(userId)
    expect(mockSocket.data.admin).toBe(true)
    expect(mockSocket.data.qaadmin).toBe(true)
    // Username provided matches the one in the database, so usernameChanged should be false
    expect(mockSocket.data.usernameChanged).toBe(false)
  })

  // Test case 3: Blocked user
  test('should reject blocked user', async () => {
    // Arrange
    const loginCode = 'blocked789'
    const userId = uuidv4()
    const username = 'blockedUser'
    
    // Create blocked user in the database
    await UserModel.create({
      _id: userId,
      code: loginCode,
      username,
      blocked: true,
      created: new Date()
    })

    const mockSocket = createMockSocket({ code: loginCode, username })
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith(new Error('User is blocked.'))
    expect(mockSocket.data.userid).toBeUndefined()
  })

  // Test case 4: Changed username for existing user
  test('should detect changed username for existing user', async () => {
    // Arrange
    const loginCode = 'changed123'
    const userId = uuidv4()
    const originalUsername = 'originalName'
    const newUsername = 'changedName'
    
    // Create existing user in the database
    await UserModel.create({
      _id: userId,
      code: loginCode,
      username: originalUsername,
      created: new Date()
    })

    const mockSocket = createMockSocket({ code: loginCode, username: newUsername })
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith()
    expect(mockSocket.data.username).toBe(newUsername)
    expect(mockSocket.data.userid).toBe(userId)
    // Username provided is different from the one in the database, so usernameChanged should be true
    expect(mockSocket.data.usernameChanged).toBe(true)
  })

  // Test case 5: Invalid login code
  test('should reject invalid login code', async () => {
    // Arrange
    const loginCode = 'invalid123'
    const username = 'invalidUser'
    
    // No login code created in the database

    const mockSocket = createMockSocket({ code: loginCode, username })
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith(new Error(`Invalid login code: ${loginCode}`))
    expect(mockSocket.data.userid).toBeUndefined()
  })

  // Test case 6: Invalid input (missing username)
  test('should reject invalid input format (missing username)', async () => {
    // Arrange
    const loginCode = 'valid123'
    
    const mockSocket = createMockSocket({ code: loginCode }) // username is missing
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Authorization rejected')
    }))
  })

  // Test case 7: Invalid input (missing code)
  test('should reject invalid input format (missing code)', async () => {
    // Arrange
    const username = 'testUser'
    
    const mockSocket = createMockSocket({ username }) // code is missing
    const mockNext = createMockNext()

    // Act
    await middleware(mockSocket as any, mockNext)

    // Assert
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Authorization rejected')
    }))
  })
})
