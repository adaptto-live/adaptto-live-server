// Jest global test setup
// This file is executed once before all tests

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  // Uncomment specific methods to suppress them during tests
  log: jest.fn(),
  debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Centralized mock for the project's logger
jest.mock('../util/log', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

// Note: Test timeout is configured in jest.config.ts (testTimeout: 10000)
