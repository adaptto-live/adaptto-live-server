import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { handleTalkRoomQAEntries } from '../../socket/talkRoomQAEntries'
import { QAEntryModel, QAEntryLikeModel, UserModel } from '../../repository/mongodb.schema'
import { SocketData } from '../../socket/socket.server.types'
import executeSocketHandler from '../helper/executeSocketHandler'

describe('Talk Room QA Entries Handler', () => {
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
    await QAEntryModel.deleteMany({})
    await QAEntryLikeModel.deleteMany({})
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
      in: jest.fn().mockReturnThis()
    }
  }

  // Test case 1: Should register QA entry event handlers
  test('should register QA entry event handlers', async () => {
    // Arrange
    const mockSocket = createMockSocket()

    // Act
    await handleTalkRoomQAEntries(mockSocket as any)

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith('qaEntry', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('qaEntryUpdate', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('qaEntryUpdateAnswered', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('qaEntryDelete', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('qaEntryLike', expect.any(Function))
  })

  // Test case 2: Should not register handlers if user data is incomplete
  test('should not register handlers if user data is incomplete', async () => {
    // Arrange
    const mockSocket = createMockSocket({ 
      userid: '', // Empty userid
      username: 'testUser'
    })

    // Act
    await handleTalkRoomQAEntries(mockSocket as any)

    // Assert
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  // Test case 3: Should create a new QA entry
  test('should create a new QA entry', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    const text = 'How does this work?'
    const mockCallback = jest.fn()
    
    const newQAEntry = {
      id: entryId,
      talkId,
      text,
      anonymous: false,
      highlight: false,
      answered: false
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntry', 
      [newQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true }, expect.any(Number))
    
    // Verify QA entry was stored in database
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry).not.toBeNull()
    expect(storedEntry?.text).toBe(text)
    expect(storedEntry?.talkId).toBe(talkId)
    expect(storedEntry?.userid).toBe('test-user-id')
    expect(storedEntry?.username).toBe('testUser')
    expect(storedEntry?.entryIndex).toBeGreaterThan(0)
    
    // Verify QA entry was broadcast to room
    expect(mockSocket.in).toHaveBeenCalledWith(talkId)
    expect(mockSocket.emit).toHaveBeenCalledWith('qaEntries', [
      expect.objectContaining({
        id: entryId,
        text,
        userid: 'test-user-id',
        username: 'testUser',
        likeUserIds: []
      })
    ])
  })

  // Test case 4: Should create an anonymous QA entry
  test('should create an anonymous QA entry', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    const mockCallback = jest.fn()
    
    const newQAEntry = {
      id: entryId,
      talkId,
      text: 'Anonymous question',
      anonymous: true,
      highlight: false,
      answered: false
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntry', 
      [newQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true }, expect.any(Number))
    
    // Verify QA entry was stored anonymously in database
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry).not.toBeNull()
    expect(storedEntry?.username).toBeUndefined()
    expect(storedEntry?.userid).toBe('test-user-id') // Note: userid is still stored
  })

  // Test case 5: Should create a reply QA entry
  test('should create a reply QA entry', async () => {
    // Arrange
    const mockSocket = createMockSocket()
    const parentEntryId = uuidv4()
    const replyEntryId = uuidv4()
    const talkId = 'test-talk-123'
    const mockCallback = jest.fn()
    
    // Create parent entry first
    await QAEntryModel.create({
      _id: parentEntryId,
      talkId,
      date: new Date(),
      userid: 'test-user-id',
      username: 'testUser',
      text: 'Original question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    const replyQAEntry = {
      id: replyEntryId,
      talkId,
      text: 'This is a reply',
      replyTo: parentEntryId,
      anonymous: false,
      highlight: false,
      answered: false
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntry', 
      [replyQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true }, expect.any(Number))
    
    // Verify reply entry was stored with correct replyTo reference
    const storedReply = await QAEntryModel.findById(replyEntryId).exec()
    expect(storedReply).not.toBeNull()
    expect(storedReply?.replyTo).toBe(parentEntryId)
    expect(storedReply?.entryIndex).toBe(0) // Replies should have entryIndex 0
  })

  // Test case 6: Should update a QA entry
  test('should update a QA entry', async () => {
    // Arrange
    const userId = 'test-user-id'
    const username = 'testUser'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry first
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: userId,
      username,
      text: 'Original question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    const mockSocket = createMockSocket({ userid: userId, username })
    const mockCallback = jest.fn()
    
    const updatedQAEntry = {
      id: entryId,
      talkId,
      text: 'Updated question',
      anonymous: false,
      highlight: true,
      answered: true
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryUpdate', 
      [updatedQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify QA entry was updated in database
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry?.text).toBe('Updated question')
    expect(storedEntry?.highlight).toBe(true)
    expect(storedEntry?.answered).toBe(true)
  })

  // Test case 7: Should not update QA entry owned by another user unless admin
  test('should not update QA entry owned by another user unless admin', async () => {
    // Arrange
    const ownerId = 'entry-owner-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry owned by someone else
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'entryOwner',
      text: 'Original question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    // Non-admin user trying to update someone else's entry
    const mockSocket = createMockSocket({ 
      userid: 'different-user-id',
      username: 'differentUser',
      admin: false
    })
    
    const mockCallback = jest.fn()
    
    const updatedQAEntry = {
      id: entryId,
      talkId,
      text: 'Attempted update by non-owner',
      anonymous: false,
      highlight: true,
      answered: true
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryUpdate', 
      [updatedQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ 
      success: false,
      error: expect.stringContaining('not found or not allowed')
    }))
    
    // Verify entry was NOT updated in database
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry?.text).toBe('Original question')
    expect(storedEntry?.highlight).toBe(false)
    expect(storedEntry?.answered).toBe(false)
  })

  // Test case 8: Should allow admin to update any QA entry
  test('should allow admin to update any QA entry', async () => {
    // Arrange
    const ownerId = 'entry-owner-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry owned by someone else
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'entryOwner',
      text: 'Original question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    // Admin user trying to update someone else's entry
    const mockSocket = createMockSocket({ 
      userid: 'admin-user-id',
      username: 'adminUser',
      admin: true
    })
    
    const mockCallback = jest.fn()
    
    const updatedQAEntry = {
      id: entryId,
      talkId,
      text: 'Admin updated question',
      anonymous: false,
      highlight: true,
      answered: true
    }
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryUpdate', 
      [updatedQAEntry, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify QA entry was updated in database
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry?.text).toBe('Admin updated question')
    expect(storedEntry?.highlight).toBe(true)
    expect(storedEntry?.answered).toBe(true)
  })

  // Test case 9: Should update just 'answered' status
  test('should update just answered status of QA entry', async () => {
    // Arrange
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: 'other-user-id',
      username: 'otherUser',
      text: 'Question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    const mockSocket = createMockSocket({ 
      userid: 'test-user-id', 
      username: 'testUser',
      qaadmin: true
    })
    
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryUpdateAnswered', 
      [{ id: entryId, answered: true }, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify only 'answered' status was updated
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry?.text).toBe('Question') // Unchanged
    expect(storedEntry?.answered).toBe(true) // Changed
  })

  // Test case 10: Should allow QA admin to update answered status
  test('should allow QA admin to update answered status', async () => {
    // Arrange
    const ownerId = 'entry-owner-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry owned by someone else
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: ownerId,
      username: 'entryOwner',
      text: 'Original question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    // QA Admin user trying to update answered status
    const mockSocket = createMockSocket({ 
      userid: 'qaadmin-user-id',
      username: 'qaAdminUser',
      qaadmin: true,
      admin: false
    })
    
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryUpdateAnswered', 
      [{ id: entryId, answered: true }, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify answered status was updated
    const storedEntry = await QAEntryModel.findById(entryId).exec()
    expect(storedEntry?.answered).toBe(true)
  })

  // Test case 11: Should delete a QA entry
  test('should delete a QA entry', async () => {
    // Arrange
    const userId = 'test-user-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: userId,
      username: 'testUser',
      text: 'Question to delete',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryDelete', 
      [entryId, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify entry was deleted
    const deletedEntry = await QAEntryModel.findById(entryId).exec()
    expect(deletedEntry).toBeNull()
    
    // Verify delete event was broadcast to room
    expect(mockSocket.in).toHaveBeenCalledWith(talkId)
    expect(mockSocket.emit).toHaveBeenCalledWith('qaEntryDelete', entryId)
  })

  // Test case 12: Should delete replies when deleting a parent QA entry
  test('should delete replies when deleting a parent QA entry', async () => {
    // Arrange
    const userId = 'test-user-id'
    const parentId = uuidv4()
    const replyId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a parent QA entry and a reply
    await QAEntryModel.create({
      _id: parentId,
      talkId,
      date: new Date(),
      userid: userId,
      username: 'testUser',
      text: 'Parent question',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    await QAEntryModel.create({
      _id: replyId,
      talkId,
      date: new Date(),
      userid: 'other-user-id',
      username: 'otherUser',
      text: 'Reply to delete',
      replyTo: parentId,
      highlight: false,
      answered: false
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryDelete', 
      [parentId, mockCallback]
    )
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify both parent and reply were deleted
    const deletedParent = await QAEntryModel.findById(parentId).exec()
    expect(deletedParent).toBeNull()
    
    const deletedReply = await QAEntryModel.findById(replyId).exec()
    expect(deletedReply).toBeNull()
  })

  // Test case 13: Should like a QA entry
  test('should like a QA entry', async () => {
    // Arrange
    const userId = 'test-user-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    
    // Create a QA entry
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: 'other-user-id',
      username: 'otherUser',
      text: 'Question to like',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    
    // Act
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryLike', 
      [{ id: entryId }, mockCallback]
    )
    
    // Add delay to allow async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify like was stored in database
    const like = await QAEntryLikeModel.findOne({ 
      qaEntryId: entryId,
      userid: userId
    }).exec()
    
    expect(like).not.toBeNull()
    expect(like?.talkId).toBe(talkId)
  })

  // Test case 14: Should unlike a previously liked QA entry
  test('should unlike a previously liked QA entry', async () => {
    // Arrange
    const userId = 'test-user-id'
    const entryId = uuidv4()
    const talkId = 'test-talk-123'
    const likeId = uuidv4()
    
    // Create a QA entry
    await QAEntryModel.create({
      _id: entryId,
      talkId,
      date: new Date(),
      userid: 'other-user-id',
      username: 'otherUser',
      text: 'Question to unlike',
      entryIndex: 1,
      highlight: false,
      answered: false
    })
    
    // Create an existing like
    await QAEntryLikeModel.create({
      _id: likeId,
      talkId,
      qaEntryId: entryId,
      date: new Date(),
      userid: userId
    })
    
    const mockSocket = createMockSocket({ userid: userId })
    const mockCallback = jest.fn()
    
    // Act - liking again should toggle it off
    await handleTalkRoomQAEntries(mockSocket as any)
    
    await executeSocketHandler(
      mockSocket as any, 
      handleTalkRoomQAEntries, 
      'qaEntryLike', 
      [{ id: entryId }, mockCallback]
    )
    
    // Add delay to allow async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Assert
    expect(mockCallback).toHaveBeenCalledWith({ success: true })
    
    // Verify like was removed from database
    const like = await QAEntryLikeModel.findOne({ 
      qaEntryId: entryId,
      userid: userId
    }).exec()
    
    expect(like).toBeNull()
  })
})
