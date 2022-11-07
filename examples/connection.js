
import { MeianSocket } from '../index.js'

const socket = MeianSocket('192.168.1.81', 18034, 'username', 'password', 'debug', 40)

/**
   * ready to send commands
   */
socket.onConnected(async (connectionResponse) => {
  console.log(`logged in (${connectionResponse})`)
})

// command
socket.onResponse(async (commandResponse) => {
  console.log(JSON.stringify(commandResponse))
})

// push events
socket.onPush(async (pushResponse) => {
  console.log(`Received push: ${JSON.stringify(pushResponse)}`)
})

socket.onDisconnected(async (disconnectionResponse) => {
  console.log(`disconnected (type: ${disconnectionResponse})`)
})

socket.onError(async (error) => {
  console.log(`Error ${error.message} - ${JSON.stringify(error.stack)}`)
})

/**
 * ready to send commands
 */
socket.onConnected(async (connectionResponse) => {
  console.log(`logged in (${connectionResponse})`)
})

// connect
socket.connect()

// wait for connection before sending data
const polling = setInterval(async () => {
  if (socket.connection.status.isReady()) {
    clearInterval(polling)

    const commands = ['GetNet', 'GetAlarmStatus', 'GetByWay']
    const commandsArgs = [[], [], [1]]
    console.log(`Testing ${JSON.stringify(commands)} (${JSON.stringify(commandsArgs)})...`)

    // send commands
    await socket.executeCommand(commands, commandsArgs)
  } else {
    console.log(`Connection not ready yet for receiving data - ${socket.connection.status.text()}...will try again later..`)
  }
}, 1000)

// delay disconnection for testing purposes
setTimeout(() => {
  socket.disconnect()
}, 120000)
