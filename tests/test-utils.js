const MeianSocket = require('../src/meian-socket')
const DataHandler = require('../src/data-handler')

function TestSocket (host, port, username, password, zonesToQuery, tests, isPushClient) {
  let testIndex = 0

  const socket = MeianSocket(host, port, username, password, 'debug', zonesToQuery, isPushClient)

  function log (message) {
    console.log(`test-socket: ${message}`)
  }

  /**
 * test execution
 * @param {*} commands
 * @param {*} commandsArgs
 */
  async function doTest (current) {
    log(`Testing ${JSON.stringify(current)}...`)

    let commands = current.command
    const commandsArgs = current.args

    if (!Array.isArray(commands)) {
      commands = [commands]
    }
    // send commands
    await socket.executeCommand(commands, commandsArgs)
  }

  if (!username || !password) {
    log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword')
  } else {
    log('will test MeianClient on ' + host + ':' + port)

    /**
   * ready to send commands
   */
    socket.onConnected(async (connectionResponse) => {
      log(`logged in (${connectionResponse})`)
    })

    // command
    socket.onResponse(async (commandResponse) => {
      log(JSON.stringify(commandResponse))

      const { GetAlarmStatus, GetByWay, GetZone } = commandResponse

      // merge responses.
      if (GetAlarmStatus && GetByWay && GetZone) {
        log(JSON.stringify(DataHandler.getZoneStatus(GetAlarmStatus, GetByWay, GetZone, zonesToQuery)))
      }

      testIndex++
      const next = tests[testIndex]
      if (next) {
        doTest(next)
      } else if (!isPushClient) {
        log('All tests done')
        // done!
        socket.disconnect()
      }
    })

    // push events
    socket.onPush(async (pushResponse) => {
      log(`Received push: ${JSON.stringify(pushResponse)}`)
    })

    socket.onDisconnected(async (disconnectionResponse) => {
      log(`disconnected (type: ${disconnectionResponse})`)
      log('exit script')
      if (disconnectionResponse === 'error') {
        log('TEST FAIL')
      }
      process.exit(0)
    })

    socket.onError(async (error) => {
      log(`Error ${error.message} - ${JSON.stringify(error.stack)}`)
      // disconnect on error
      socket.disconnect('error')
    })

    /**
   * ready to send commands
   */
    socket.onConnected(async (connectionResponse) => {
      log(`logged in (${connectionResponse})`)
    })

    // connect
    socket.connect()

    // wait for connection before sending data
    const polling = setInterval(() => {
      if (socket.connection.status.isReady()) {
        clearInterval(polling)
        const next = tests[testIndex]
        if (next) {
          doTest(next)
        }
      } else {
        log(`Connection not ready yet for receiving data - ${socket.connection.status.text()}...will try again later..`)
      }
    }, 1000)

    // delay disconnection for pushClient
    if (isPushClient) {
      setTimeout(() => {
        socket.disconnect()
      }, 120000)
    }
  }
}

module.exports = TestSocket
