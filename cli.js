#!/usr/bin/env node
import { MeianSocket, MeianDataHandler, MeianCommands } from './index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs'
function log (message) {
  console.log(`meian-client: ${message}`)
}
function exec (host, port, username, password, zonesToQuery, commands, commandArgs, saveFile) {
  if (!commands || commands.length === 0) {
    log('Provided empty command list...nothing to do. Bye.')
    return
  }

  log(`Running commands: ${JSON.stringify(commands)} (${JSON.stringify(commandArgs)}) meian-cli on host ${host}:${port} with username ${username}`)

  const socket = MeianSocket(host, port, username, password, 'debug', zonesToQuery)

  function dumpResponses (commandResponse, saveFile) {
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

    fs.writeFileSync(saveFile, JSON.stringify(testFile, undefined, 2))

    log(`File ${saveFile} created`)
  }

  /**
 * test execution
 * @param {*} commands
 * @param {*} commandsArgs
 */
  async function doTest (commands, commandsArgs) {
    // parse list

    log(`Executing commands ${JSON.stringify(commands)} (${JSON.stringify(commandsArgs)})...`)

    if (!Array.isArray(commands)) {
      commands = [commands]
    }
    // send commands
    await socket.executeCommand(commands, commandsArgs)
  }

  if (!username || !password) {
    log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword')
  } else {
    log('will test MeianSocket on ' + host + ':' + port)

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
        dumpResponses(commandResponse, saveFile)
      }

      // merge responses.
      if (GetAlarmStatus && GetByWay && GetZone) {
        log(JSON.stringify(MeianDataHandler.getZoneStatus(GetAlarmStatus, GetByWay, GetZone, zonesToQuery)))
      }

      setTimeout(() => {
        socket.disconnect()
      }, 1000)
    })

    // push events
    socket.onPush(async (pushResponse) => {
      log(`Received push: ${JSON.stringify(pushResponse)}`)
    })

    socket.onDisconnected(async (disconnectionResponse) => {
      log(`disconnected (type: ${disconnectionResponse})`)
      log('exit script')
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
        doTest(commands, commandArgs)
      } else {
        log(`Connection not ready yet for receiving data - ${socket.connection.status.text()}...will try again later..`)
      }
    }, 1000)
  }
}

// parsing args
const argv = yargs(hideBin(process.argv))
  .option('commands', {
    alias: 'c',
    type: 'array',
    description: 'List of commands to execute. Can contain args: SetByWay(2,false)',
    demandOption: true
  })
  .option('host', {
    alias: 's',
    type: 'String',
    description: 'ip of the alarm',
    demandOption: true
  })
  .option('port', {
    alias: 'n',
    type: 'number',
    description: 'TCP port',
    default: 18034
  })
  .option('username', {
    alias: 'u',
    type: 'string',
    description: 'Username required for logging in',
    demandOption: true
  })
  .option('password', {
    alias: 'p',
    type: 'string',
    description: 'Password required for logging in',
    demandOption: true
  })
  .option('zones', {
    alias: 'z',
    type: 'number',
    description: 'Number of configured zones',
    demandOption: false,
    default: 128
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'JSON file where to dump the output of the commands',
    demandOption: false
  })

  .argv

const commands = []
const commandsArgs = []

argv.commands.forEach(cmd => {
  const commandParser = cmd.trim().match(/([Get|Set][a-zA-Z]+)([(].+[)])?/)
  const commandName = commandParser[1]
  // if it's a known command
  if (MeianCommands[commandName]) {
    commands.push(commandName)
    const currentArgs = []

    if (commandParser[2]) {
      let argsText = commandParser[2].substring(1)
      argsText = argsText.substring(0, argsText.length - 1)
      const argumentsParser = argsText.split(',')
      argumentsParser.forEach(cmdArg => {
        if (cmdArg.trim()) {
          currentArgs.push(cmdArg.trim())
        }
      })
    }

    commandsArgs.push(currentArgs)
  } else {
    log(`Skipped unknown command: ${commandName}`)
  }
})

exec(argv.host.trim(), argv.port, argv.username.trim(), argv.password.trim(), argv.zones, commands, commandsArgs, argv.output ? argv.output.trim() : undefined)
