// Jest global test setup
// This file is executed once before all tests

// Mock console methods to reduce noise during testing
global.console = {
  ...console,
  // ignore specific console methods during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Note: Test timeout is configured in jest.config.ts (testTimeout: 10000)
