
import { MeianClient, MeianDataHandler } from '../index.js'
import fs from 'fs'

function TestSocket (host, port, username, password, zonesToQuery, tests, isPushClient, saveFile) {
  return new Promise((resolve) => {
    let testIndex = 0

    const socket = MeianClient(host, port, username, password, 'debug', zonesToQuery, isPushClient)

    function log (message) {
      console.log(`test-socket: ${message}`)
    }

    function dumpResponses (commandResponse) {
      const testFile = {}
      Object.keys(commandResponse.payloads.data).forEach(command => {
        const encrypted = commandResponse.payloads.encrypted[command][0]
        const xml = commandResponse.payloads.xml[command][0]
        const rawData = commandResponse.payloads.rawData[command][0]
        const data = commandResponse.payloads.data[command]

        testFile[command] = {
          encrypted,
          xml,
          rawData,
          data
        }
      })

      fs.writeFileSync('./tests/test-dump.json', JSON.stringify(testFile, undefined, 2))
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

        const { GetAlarmStatus, GetByWay, GetZone } = commandResponse.payloads.data

        if (saveFile) {
          dumpResponses(commandResponse)
        }

        // merge responses.
        if (GetAlarmStatus && GetByWay && GetZone) {
          log(JSON.stringify(MeianDataHandler.getZoneStatus(GetAlarmStatus, GetByWay, GetZone, zonesToQuery)))
        }

        testIndex++
        const next = tests[testIndex]
        if (next) {
          doTest(next)
        } else if (!isPushClient) {
          log('All tests done')
          // done!
          socket.disconnect()

          setTimeout(() => {
            resolve(Object.keys(commandResponse.payloads.data))
          }, 1000)
        }
      })

      // push events
      socket.onPush(async (pushResponse) => {
        log(`Received push: ${JSON.stringify(pushResponse)}`)
        setTimeout(() => {
          resolve('push')
        }, 1000)
      })

      socket.onDisconnected(async (disconnectionResponse) => {
        log(`disconnected (type: ${disconnectionResponse})`)
        log('exit script')

        setTimeout(() => {
          resolve('ok')
        }, 1000)

        if (disconnectionResponse === 'error') {
          log('TEST FAIL')

          setTimeout(() => {
            resolve('error')
          }, 1000)
        }
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
  })
}

export default TestSocket
