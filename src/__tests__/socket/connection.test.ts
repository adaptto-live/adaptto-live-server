import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { handleConnection } from '../../socket/connection'
import { UserModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'

describe('Connection Handler', () => {
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
      on: jest.fn()
    }
  }

  // Test case 1: Should emit login event with correct parameters
  test('should emit login event with correct parameters', async () => {
    // Arrange
    const mockSocket = createMockSocket({
      userid: 'user123',
      username: 'testUser',
      admin: true,
      qaadmin: false
    })

    // Act
    const result = await handleConnection(mockSocket as any)

    // Assert
    expect(mockSocket.emit).toHaveBeenCalledWith('login', 'user123', true, false)
    expect(result).toEqual({
      userid: 'user123',
      username: 'testUser',
      admin: true
    })
  })

  // Test case 2: Should handle username change
  test('should update username when usernameChanged is true', async () => {
    // Arrange
    const userId = 'user456'
    const oldUsername = 'oldUser'
    const newUsername = 'newUser'

    // Create a user in the database first
    await UserModel.create({
      _id: userId,
      code: 'test-code',
      username: oldUsername,
      created: new Date()
    })

    const mockSocket = createMockSocket({
      userid: userId,
      username: newUsername,
      usernameChanged: true
    })

    // Act
    await handleConnection(mockSocket as any)

    // Assert
    // Check if database was updated
    const updatedUser = await UserModel.findOne({ _id: userId }).exec()
    expect(updatedUser).not.toBeNull()
    expect(updatedUser?.username).toBe(newUsername)
  })

  // Test case 3: Should handle incomplete user data
  test('should return early if userid or username is missing', async () => {
    // Arrange - missing username
    const mockSocketMissingUsername = createMockSocket({
      userid: 'user789',
      username: ''
    })

    // Act
    const result1 = await handleConnection(mockSocketMissingUsername as any)

    // Assert
    expect(result1).toBeUndefined()
    expect(mockSocketMissingUsername.emit).not.toHaveBeenCalled()

    // Arrange - missing userid
    const mockSocketMissingUserid = createMockSocket({
      userid: '',
      username: 'someUser'
    })

    // Act
    const result2 = await handleConnection(mockSocketMissingUserid as any)

    // Assert
    expect(result2).toBeUndefined()
    expect(mockSocketMissingUserid.emit).not.toHaveBeenCalled()
  })

  // Test case 4: Should register disconnect handler
  test('should register disconnect handler', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleConnection(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
  })
})
