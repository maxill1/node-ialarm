
const convert = require('xml-js')
const { MeianConnection, ConnectionStatus } = require('./meian-connection')
const { MeianMessage, MeianMessageFunctions } = require('./meian-message')
const tcpResponseFormatters = require('./tcp-response-formatters')()
const MeianEvents = require('./meian-events')
const constants = require('./constants')

function initListLimits (limit) {
  const num = parseInt(limit)
  if (num > 0) {
    return {
      ...constants.listLimit,
      GetByWay: num, // usually 128
      GetZone: num, // usually 128
      default: num // usually 128
    }
  }

  return {
    ...constants.listLimit,
    ...(limit || {})
  }
}

function getListLimit (commandName, limits) {
  return limits[commandName] || limits.default
}

/**
 * Meian socket interface
 * @param {*} host
 * @param {*} port
 * @param {*} uid
 * @param {*} pwd
 * @param {*} logLevel
 * @returns
 */
function MeianSocket (host, port, uid, pwd, logLevel, customListLimit, isPushClient) {
  const logger = MeianConnection.initLogger(logLevel)

  // default
  port = port || 18034

  // default is 128 to avoid problems and let zones populate. We can limit to few if we just want some row from GetLog
  const listLimit = initListLimits(customListLimit)

  /**
   * random id for concurrency and logging purposes
   * @param {*} min
   * @param {*} max
   * @returns
   */
  function randomId (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  const transactionToString = MeianConnection.transactionToString
  const updateStatus = MeianConnection.updateStatus

  /**
   * Command name from response
   * @param {*} response
   * @returns
   */
  function getCmdName (response) {
    const root = response && response.Root
    if (root) {
      // es. Root/Host/GetZone > GetZone Root/Host/Alarm (push notification)
      if (root.Host) {
        const cmdName = Object.keys(root.Host)[0]
        return cmdName
      }
      // login Root/Pair/Client
      if (root.Pair && root.Pair) {
        const cmdName = Object.keys(root.Pair)[0]
        return cmdName
      }
    }

    return undefined
  }

  /**
   * preapare the message to send
   * @param {*} command
   * @param {*} currentArgs
   */
  function createMessage (command, currentArgs) {
    if (!currentArgs) {
      currentArgs = []
    } else if (!Array.isArray(currentArgs)) {
      currentArgs = [currentArgs]
    }
    const funct = MeianMessageFunctions[command]
    if (!funct) {
      throw new Error(`Unknown command: ${command}`)
    }
    const msg = funct(...currentArgs)
    return msg
  }

  /**
   * Send all commands
   * @param {1} commandNames
   * @param {*} commandArgs
   * @returns
   */
  async function sendCommands (commandNames, commandArgs) {
    if (!Array.isArray(commandNames)) {
      commandNames = [commandNames]
    }

    // single id that identifies this specific commands execution
    const transactionId = `${randomId(1, 9999)}`

    const commandData = {
      commandNames,
      commandArgs,
      connectionId: MeianConnection.connectionName,
      transactionId: transactionId,
      date: new Date().getTime()
    }

    for (let currentIndex = 0; currentIndex < commandNames.length; currentIndex++) {
      const currentCommand = commandNames[currentIndex]

      // 3) send protocol messages in sequence
      const currentArgs = commandArgs && commandArgs[currentIndex]
      // prepare the message
      const msg = createMessage(currentCommand, currentArgs)

      const logId = transactionToString(transactionId, currentCommand, currentIndex, currentArgs)

      // send
      const response = await sendMessage(msg, { command: currentCommand, args: currentArgs, commandIndex: currentIndex }, transactionId)

      // will be overridden later if necessary
      let formattedResponse = response

      // data formatters
      const formatter = tcpResponseFormatters[currentCommand]

      if (response && !response.timeout && !response.error) {
        logger.log('debug', `${logId} args ${JSON.stringify((commandArgs && commandArgs[currentIndex]) || 'n/a')}) responded with a json sized ${JSON.stringify(response).length} chars`)

        // list handler (multiple messages in chain)
        const list = []
        if (msg.isList && response?.commandName === currentCommand) {
          const responseRaw = response.Root.Host[currentCommand]
          // first response of the list
          list.push(responseRaw)

          // lets determine the size of the whole list
          const total = tcpResponseFormatters.cleanData(responseRaw.Total.value) || 0
          const offset = tcpResponseFormatters.cleanData(responseRaw.Offset.value)
          const ln = tcpResponseFormatters.cleanData(responseRaw.Ln.value) || 0

          // es: GetZone has total = 40, ln = 2, offset = 0. We need to call the same command 20 times before getting all the Zones
          const cicles = Math.ceil(total / ln)

          const limit = getListLimit(currentCommand, listLimit)

          for (let currentOffset = offset; currentOffset < cicles; currentOffset++) {
            const newOffset = currentOffset * ln

            // first offset is already done
            if (currentOffset === 0) {
              logger.log('debug', `${logId}: responded with Ln, Total and Offset: it's a list. Done offset ${currentOffset + 1}/${cicles}. We are populating remaining ${total - ln}/${total} items (with limit at ${limit})`)
              continue
            }

            // max calls size (es. GetLog is 512 items and every call has 2 item... 256 calls may take more than 30 sec)
            if ((total > (limit - 1) && (newOffset / 2) > (limit - 1)) ||
              // the offset is outside the total
              newOffset >= total) {
              // list is complete
              break
            }

            // call the same command with different offset
            const msg = createMessage(currentCommand, newOffset)
            // promise for list retrieval
            // eslint-disable-next-line no-unused-vars
            const listResponseRaw = await sendMessage(msg, { command: currentCommand, args: newOffset, commandIndex: msg.currentIndex }, transactionId)
            if (listResponseRaw.error) {
              logger.log('error', `${logId}: querying ${currentCommand} ${currentOffset + 1}/${cicles}. We are populating items ${newOffset}-${newOffset + ln > total ? total : newOffset + ln} of ${total} total list (with limit at ${limit}). Responded with an error: ${listResponseRaw.error}`)
            } else {
              logger.log('debug', `${logId}: querying ${currentCommand} ${currentOffset + 1}/${cicles}. We are populating items ${newOffset}-${newOffset + ln > total ? total : newOffset + ln} of ${total} total list (with limit at ${limit}). Responded with a json sized ${JSON.stringify(responseRaw).length} chars`)
              // first response of the list
              list.push(listResponseRaw.Root.Host[currentCommand])
            }
          }

          if (formatter) {
            formattedResponse = formatter(list)
          }
        }
      }

      const hostData = response?.Root?.Host[currentCommand]
      if (formatter && hostData && !response.error) {
        formattedResponse = formatter(hostData)
      }

      // add partial command to command response
      commandData[currentCommand] = formattedResponse
    }

    return commandData
  }

  /**
   * connect and login
   * @returns
   */
  function connect () {
    if (!MeianConnection.status.isDisconnected()) {
      MeianEvents.error(`Connection status: ${MeianConnection.status.text()}: only one TCP client connection is allowed. New connection is ignored.`)
      // TODO alternatively emit some kind of keepalive and check if it responds
      return
    }

    const loginTransactionId = `${randomId(1, 9999)}`

    // update current connection status
    MeianConnection.connectionName = `${randomId(1, 9999)}`
    updateStatus(ConnectionStatus.CONNECTING, loginTransactionId)

    logger.log('debug', `${transactionToString(loginTransactionId)}: connecting to ${host}:${port}`)

    // remove previous response listener
    MeianConnection.socket.removeAllListeners('timeout')
    MeianConnection.socket.removeAllListeners('error')
    MeianConnection.socket.removeAllListeners('connect')
    MeianConnection.socket.removeAllListeners('end')
    MeianConnection.socket.removeAllListeners('data')
    MeianEvents.clear()

    // handle tcp timeout
    MeianConnection.socket.on('timeout', (e) => {
      logger.error(`${transactionToString(loginTransactionId)} tcp socket timeout`)
      // in case of timeout better close the connection
      disconnect()
      MeianEvents.error(`${transactionToString(loginTransactionId)} tcp socket timeout`)
    })
    // handle errors
    MeianConnection.socket.on('error', function (error) {
      logger.error(`${transactionToString()}: error ${error && error.message}`)
      MeianEvents.error(error)
      // in case of error better close the connection
      disconnect()
    })

    MeianConnection.socket.on('connect', () => {
      // update current connection status
      updateStatus(ConnectionStatus.CONNECTED, loginTransactionId)
      logger.log('debug', `${transactionToString(loginTransactionId)}: connected to ${host}:${port}`)
    })

    // handle connection closed by other side
    MeianConnection.socket.on('close', function (hadError) {
      // update current connection status
      updateStatus(ConnectionStatus.DISCONNECTED)
      logger.log('debug', `${transactionToString()}: connection closed on ${host}:${port} ${hadError ? 'with error' : ''}`)
      MeianEvents.disconnected('close', hadError)
    })

    MeianConnection.socket.on('end', () => {
      // update current connection status
      updateStatus(ConnectionStatus.DISCONNECTED)
      logger.log('debug', `${transactionToString()}: disconnected from ${host}:${port}`)
      MeianEvents.disconnected('close')
    })

    // remove previous response listener
    MeianConnection.socket.removeAllListeners('data')

    // 3a) command data resolved
    MeianConnection.socket.on('data', async function (buffer) {
      try {
        if (!buffer) {
          // no buffer??
          logger.warning(`${transactionToString()} - No buffer received from Alarm`)
          MeianEvents.error('Received empty response from Alarm')
        }
        const raw = String.fromCharCode.apply(null, buffer)
        if (!raw) {
          // no raw/bad raw??
          logger.warning(`${transactionToString()} - No raw decoded from buffer with length ${(buffer && buffer.length) || 0}`)
          MeianEvents.error('Received bad buffer from Alarm')
        }
        let xml = MeianMessage().extractMessage(raw)
        // cleanup <Err>ERR|00</Err> at root
        let Err
        if (xml.indexOf('<Err>ERR') === 0) {
          const error = xml.substring(0, xml.indexOf('</Err>') + 6)
          xml = xml.replace(error, '')
          Err = convert.xml2js(error, { compact: true, textKey: 'value' })
        }
        const data = convert.xml2js(xml, { compact: true, textKey: 'value' })
        // apply <Err>ERR|00</Err> at root
        if (Err) {
          data.Err = Err.Err.value
        }

        const command = getCmdName(data)
        // we presume this is the transaction id for this command
        const { transactionId, commandIndex, args } = MeianConnection.getTransaction(command)

        const commandPrettyName = transactionToString(transactionId, command, commandIndex, args)

        logger.log('debug', `${commandPrettyName}: received buffer with length ${buffer && buffer.length}`)

        // update current connection status (received data=ready for next command)
        updateStatus(ConnectionStatus.CONNECTED_READY, transactionId, command, commandIndex, args)

        // TODO check errors
        if (data.Err && data.Err !== 'ERR|00') {
          MeianEvents.error(`Alarm responded with Error ${JSON.stringify(data.Err)}`)
        } else {
          if (!data) {
            // no data??
            logger.warning(`${commandPrettyName}: command sent but no valid data received - command received ${command}, data: ${JSON.stringify(data)}`)
          }

          // requested something but received another response...yes it happens, most of the time the response is a push notification "Alarm" command
          // using EventEmitter allows us to receive multiple response from one command and resolve only the correct one
          if (command === 'Alarm') {
            const formatter = tcpResponseFormatters[command]
            const alarmContent = formatter(data.Root.Host[command])
            logger.warning(`${commandPrettyName}: command sent but received an 'Alarm' push notification... ${alarmContent}`)
            MeianEvents.push({
              commandName: command, // name of the original command in response
              // debug data
              connectionId: MeianConnection.connectionName,
              transactionId: transactionId,
              raw: data,
              ...alarmContent
            })
          } else {
            MeianEvents.commandResponse(
              command,
              {
                commandName: command, // name of the original command in response
                // debug data
                connectionId: MeianConnection.connectionName,
                transactionId: transactionId,
                // actual response
                ...data
              })
          }
        }
      } catch (error) {
        MeianEvents.error(error)
      }
    })

    // 1) connect and send login data
    MeianConnection.socket.connect(port, host, async function () {
      MeianConnection.lastConnection = new Date().getTime()

      // 2) Send the login/subscribe request
      try {
        if (isPushClient) {
          const response = await subscribe(loginTransactionId)
          logger.log('info', `${transactionToString(loginTransactionId)}: subscribed to ${host}:${port} with response ${JSON.stringify(response)}`)
          MeianEvents.connected(MeianConnection.lastSubscribe)
        } else {
          const response = await login(loginTransactionId)
          logger.log('info', `${transactionToString(loginTransactionId)}: logged in to ${host}:${port} with response ${JSON.stringify(response)}`)
          MeianEvents.connected(MeianConnection.lastLogin)
        }
      } catch (error) {
        MeianEvents.error(error)
      }
    })
  }

  /**
 * send a login message to the tcp protocol (and wait for a response)
 */
  async function login (transactionId) {
    MeianConnection.lastConnection = new Date().getTime()

    logger.log('debug', `${transactionToString(transactionId)}: logging in to ${host}:${port}`)

    const loginMsg = MeianMessageFunctions.Client(uid, pwd)
    const loginResponse = await sendMessage(loginMsg, { command: 'Client' }, transactionId, ConnectionStatus.CONNECTED_AUTHENTICATING)
    MeianConnection.lastLogin = new Date().getTime()

    return loginResponse
  }

  /**
 * subscribe to message to push service on tcp protocol (and wait for responses)
 */
  async function subscribe (transactionId) {
    MeianConnection.lastConnection = new Date().getTime()

    logger.log('debug', `${transactionToString(transactionId)}: subscribing push client to ${host}:${port}`)

    const pushMsg = MeianMessageFunctions.Push(uid)
    const pushResponse = await sendMessage(pushMsg, { command: 'Push' }, transactionId, ConnectionStatus.CONNECTED_AUTHENTICATING)
    MeianConnection.lastSubscribe = new Date().getTime()

    return pushResponse
  }

  /**
   * send a new message to the tcp protocol (and wait for a response)
   */
  async function sendMessage (msg, cmd, transactionId, status) {
    return new Promise((resolve, reject) => {
      const { command, args } = cmd
      const commandPrettyName = transactionToString(transactionId, command, msg.currentIndex, args)

      // idle or autenticating
      if (!MeianConnection.status.isReady() && (status !== ConnectionStatus.CONNECTED_AUTHENTICATING)) {
        const errorMessage = `${commandPrettyName}: ${getStatusErrors()}. New requests will be ignored until we receive a response from previous message.`
        reject(new Error(errorMessage))
        return
      }

      logger.log('debug', `${commandPrettyName}: sending command`)

      MeianEvents.onCommandResponse(command, (commandResponse) => {
        // finally the "real" command response...
        clearTimeout(timeout)
        resolve(commandResponse)
      })

      const promiseTimeout = constants.promiseTimeout
      const timeout = setTimeout(() => {
        resolve({
          timeout: promiseTimeout,
          error: `Timeout: After ${promiseTimeout}ms no response has been received by command ${command}: ${JSON.stringify(msg)}`
        })
      }, promiseTimeout)

      // update current connection status (connecting, autenticating, busy, etc)
      if (status) {
        updateStatus(status, transactionId, command, msg.currentIndex, args)
      } else {
        updateStatus(ConnectionStatus.CONNECTED_BUSY, transactionId, command, msg.currentIndex, args)
      }

      const message = msg.message

      // write message
      MeianConnection.socket.write(message, (error, _data) => {
        if (error) {
          console.log(`${commandPrettyName}: socket write error: ${JSON.stringify(error)}`)
          MeianEvents.error(error)
        }
      })
    })
  }

  function disconnect () {
    MeianConnection.socket.end()
    MeianConnection.socket.destroy()
    MeianConnection.socket.removeAllListeners('timeout')
    MeianConnection.socket.removeAllListeners('connect')
    MeianConnection.socket.removeAllListeners('data')
    MeianConnection.lastDisconnection = new Date().getTime()
  }

  function getStatusErrors () {
    if (!MeianConnection.status.isReady()) {
      let err = 'Client is not ready'
      switch (MeianConnection.status.value) {
        case ConnectionStatus.DISCONNECTED:
          err = 'Client is disconnected'
          break
        case ConnectionStatus.CONNECTED_AUTHENTICATING:
          err = 'Client is authenticating'
          break
        case ConnectionStatus.CONNECTED_BUSY:
          err = 'Client is currently waiting for a response'
          break
        case ConnectionStatus.CONNECTING:
          err = 'Client is connecting'
          break
        case ConnectionStatus.CONNECTED:
          err = 'Client is not yet authenticated'
          break
        default:
          break
      }
      return err
    }
    return ''
  }

  return {
    /**
     * connect to the server: 1) connect and 2) login
     */
    connect: connect,
    disconnect: disconnect,
    /**
     * Connect to the TCP socket and execute all the commands
     * @param {*} commandNames
     * @param {*} commandArgs
     * @param {*} listLimit
     * @returns
     */
    executeCommand: async function (commandNames, commandArgs) {
      // 1) connect and 2) login needs to be done already and no other message should have been sent
      if (!MeianConnection.status.isReady()) {
        const err = getStatusErrors()
        MeianEvents.error(`${err}. New requests will be ignored until we receive a response.`)
        return
      }
      const id = transactionToString()
      try {
        // 3) command sequence
        const response = await sendCommands(commandNames, commandArgs, listLimit)
        logger.debug(`${response.transactionId}: data sent ${JSON.stringify(commandNames)} (${(commandArgs && JSON.stringify(commandArgs)) || 'no args'})`)
        // 4) resolve data on client with onResponse
        MeianEvents.response(response)
        return response
      } catch (error) {
        logger.error(`${id}: throw an error:`, error)
        MeianEvents.error(error)
      }
    },
    /**
     * Do stuff on connection
     */
    onConnected: MeianEvents.onConnected,
    /**
     * Do stuff on discconnection
     */
    onDisconnected: MeianEvents.onDisconnected,
    /**
     * Do stuff on error
     */
    onError: MeianEvents.onError,
    /**
     * Do stuff on response
     */
    onResponse: MeianEvents.onResponse,
    /**
     * Do stuff on push event (Alarm)
     */
    onPush: MeianEvents.onPush,
    connection: MeianConnection
  }
}

module.exports = MeianSocket
