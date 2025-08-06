  /**
   * Helper to test socket event handlers by executing the handler with specified parameters
   * and waiting for it to complete before proceeding with assertions
   * 
   * @param mockSocket - The mock socket object
   * @param handlerFunction - The socket handler function to test (e.g., handleCurrentTalk)
   * @param eventName - The event name to intercept (e.g., 'currentTalk')
   * @param handlerParams - Array of parameters to pass to the handler function
   * @returns Promise that resolves when the handler has completed execution
   */
export default async function executeSocketHandler(
  mockSocket: any,
  handlerFunction: (socket: any) => Promise<void>, 
  eventName: string, 
  handlerParams: any[] = []
): Promise<void> {
  return new Promise<void>(async resolve => {
    // Mock the 'on' method to capture and execute the handler
    mockSocket.on.mockImplementation((event: string, handler: any) => {
      if (event === eventName) {
        // Execute the handler and resolve when done
        (async () => {
          await handler(...handlerParams)
          resolve()
        })()
      }
    })
    
    // Call the function that registers the handler
    await handlerFunction(mockSocket)
  })
}
