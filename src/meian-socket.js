
const convert = require('xml-js')
const net = require('net')
const { MeianMessage, MeianMessageFunctions } = require('./meian-message')
const tcpResponseFormatters = require('./tcp-response-formatters')()
const constants = require('./constants')

/**
 * Command name from response
 * @param {*} response
 * @returns
 */
function _getCmdName (response) {
  // es. Root/Host/GetZone > GetZone
  if (response && response.Root && response.Root.Host) {
    const cmdName = Object.keys(response.Root.Host)[0]
    return cmdName
  }
  if (response && response.Pair && response.Pair.Client) {
    return 'login'
  }
  return undefined
}

function MeianSocket (host, port, uid, pwd, logLevel) {
  const logger = require('./logger')(logLevel)

  this.executeCommand = function (commandNames, commandArgs) {
    const prom = MeianPromise(host, port, uid, pwd, commandNames, commandArgs)
    return new Promise((resolve, reject) => {
      // 1) connect and 2) login
      prom.connect().then(function (loginOK) {
        // 3) command sequence
        return prom.sendCommands()
      }).then((promiseData) => {
        logger.info(`${JSON.stringify(commandNames)}: resolved`)
        // 4) disconnect socket
        prom.disconnect()
        // 5) resolve data
        resolve(promiseData)
      }).catch((e) => {
        logger.error(`${JSON.stringify(commandNames)}: throw an error:`, e)
        reject(e)
      })
      // .finally(() => {
      //   logger.log('debug', `${JSON.stringify(commandNames)}: executed`)
      // })
    })
  }

  /**
   * Connect, login and send messages, then return the response in multiple chained promises
   * @returns
   */
  function MeianPromise (host, port, uid, pwd, commandNames, commandArgs) {
  // multiple command execution
    if (commandNames && !Array.isArray(commandNames)) {
      commandNames = [commandNames]
      commandArgs = [commandArgs]
    }

    if (!commandNames || commandNames.length === 0) {
      throw new Error('No command provided to send')
    }

    // default
    port = port || 18034
    const self = this

    // list container
    const lists = {}
    const maxListCallSize = 100
    const socketTimeout = 10000
    // client status
    let socketStatus = 'disconnected'

    const socket = new net.Socket()
    socket.setTimeout(socketTimeout)

    /**
   * append the command to the tcp socket
   * @param {*} command
   * @param {*} currentArgs
   */
    function _writeCommand (command, currentArgs) {
      if (!currentArgs) {
        currentArgs = []
      } else if (!Array.isArray(currentArgs)) {
        currentArgs = [currentArgs]
      }
      const msg = MeianMessageFunctions[command](...currentArgs)
      if (msg.socketStatus) {
        socketStatus = msg.socketStatus
      }
      return msg
    }

    self.disconnect = function () {
      if (socketStatus !== 'disconnected' || socket.connecting || socket.pending) {
        logger.log('debug', `${commandNames}: requested disconnection from ${host}:${port} ${socket.connecting ? '(connecting)' : ''} ${socket.pending ? '(pending)' : ''}`)
        socket.end()
      }
    }

    /**
   * connect and login
   * @returns
   */
    self.connect = function () {
      socketStatus = 'connecting'
      return new Promise((resolve, reject) => {
        logger.log('debug', `${commandNames}: connecting to ${host}:${port}`)

        // handle tcp timeout
        socket.on('timeout', (e) => {
          logger.error(`${commandNames} tcp socket timeout`)
          socket.end()
          reject(new Error(`${commandNames} tcp socket timeout`))
        })
        // handle errors
        socket.on('error', function (error) {
          logger.error(`${commandNames}: error ${error && error.message}`)
          reject(error)
        })

        socket.on('connect', () => {
          socketStatus = 'connected'
          logger.log('debug', `${commandNames}: connected to ${host}:${port}`)
        })

        // handle connection closed by other side
        socket.on('close', function (hadError) {
          socketStatus = 'disconnected'
          logger.log('debug', `${commandNames}: connection closed on ${host}:${port} ${hadError ? 'with error' : ''}`)
        })

        socket.on('end', () => {
          socketStatus = 'disconnected'
          logger.log('debug', `${commandNames}: disconnected from ${host}:${port}`)
        })

        // 1) connect and send login data
        socket.connect(port, host, function () {
          logger.log('debug', `${commandNames}: logging in to ${host}:${port}`)

          const loginMsg = MeianMessageFunctions.Client(uid, pwd)
          socketStatus = loginMsg.socketStatus

          // 2) Send the login request
          self.sendMessage(loginMsg, { command: 'login' }).then((loginResponse) => {
            logger.log('debug', `${commandNames}: logged in to ${host}:${port}`)
            resolve('OK')
          }).catch((e) => {
            reject(e)
          })
        })
      })
    }

    /**
   * Send all commands
   * @param {1} commandNames
   * @param {*} commandArgs
   * @returns
   */
    self.sendCommands = function () {
      const promiseData = {}
      // 3) send protocol messages in sequence
      return commandNames.reduce(
        (p, currentCommand, currentIndex) => {
          const prom = p.then(_ => {
            const currentArgs = commandArgs && commandArgs[currentIndex]
            const msg = _writeCommand(currentCommand, currentArgs)
            return self.sendMessage(
              msg,
              {
                command: currentCommand,
                args: currentArgs
              },
              promiseData)
          })

          if (currentIndex === commandNames.length - 1) {
            prom.finally(() => {
            // terminating io
              socket.destroy()
            })
          }
          return prom
        },
        Promise.resolve()
      )
    }

    /**
   * send a new message to the tcp protocol
   */
    self.sendMessage = function (msg, cmd, promiseData) {
      const { command, args } = cmd

      const commandPrettyName = `${command}${args ? '(' + JSON.stringify(args) + ')' : ''}`

      logger.log('debug', `${commandPrettyName}: sending command`)
      if (!promiseData) {
        promiseData = {}
      }
      if (!promiseData.data) {
        promiseData.data = {}
      }
      // Prepare an empty storage for the list/raw that will be used by all the events with different offsets
      if (msg.isList && (!msg.offset || msg.offset === 0 || !lists[command])) {
        lists[command] = {}
      }
      const message = msg.message

      // remove previous response listener
      socket.removeAllListeners('data')

      return new Promise((resolve, reject) => {
      // 3a)command data resolved
        socket.on('data', function (buffer) {
          logger.log('debug', `${commandPrettyName}: received buffer with length ${buffer.length}`)
          let cmdName = ''
          try {
            const raw = String.fromCharCode.apply(null, buffer)
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

            cmdName = _getCmdName(data)

            // TODO check errors
            if (data.Err && data.Err !== 'ERR|00') {
              reject(new Error(`Alarm responded with ${JSON.stringify(data.Err)}`))
            } else {
            // custom event based on query
              let event = constants.events[cmdName] || // custom command
                            cmdName || // host command (GetZone, GetByWay)
                            constants.events.default // response;
              if (socketStatus === 'autenticating') {
                event = 'connected'
                socketStatus = event
              }

              // raw response or formatted response
              let response = data
              // data formatters
              if (data.Root.Host) {
                const formatter = tcpResponseFormatters[cmdName]
                if (formatter) {
                  response = formatter(data.Root.Host[cmdName], lists[cmdName])
                }
              }

              let done = false
              // list handler (multiple messages in chain)
              if (cmdName && lists[cmdName]) {
              // current list
                lists[cmdName] = response

                // lets determine the offset size
                const latestRaw = response.raw[response.raw.length - 1]
                const total = tcpResponseFormatters.cleanData(latestRaw.Total.value) || 0
                const offset = tcpResponseFormatters.cleanData(latestRaw.Offset.value)
                const ln = tcpResponseFormatters.cleanData(latestRaw.Ln.value) || 0
                const newOffset = offset + ln

                if ((total > maxListCallSize && (newOffset / 2) > maxListCallSize) || // max calls size (es. GetLog is 512 items and every call has 2 item... 256 calls may take more than 30 sec)
                                newOffset >= total) { // the offset is outside the total
                // list is complete
                  done = true
                } else {
                // call the same command with different offset
                  const msg = _writeCommand(cmdName, newOffset)
                  // promise for list retrieval
                  self.sendMessage(
                    msg,
                    {
                      command: cmdName,
                      args: newOffset
                    },
                    promiseData)
                    .then((response) => {
                    // response already was added by previous resolve
                      resolve(promiseData)
                    })
                    .catch((e) => {
                      reject(e)
                    })
                }
              } else {
              // not a list: we can emit the response
                done = true
              }

              if (done) {
                promiseData.data[event] = response
                resolve(promiseData)
              }
            }
          } catch (error) {
            reject(new Error(`${cmdName} ${error.message}`))
          }
        })

        socket.write(message)
      })
    }

    return self
  }

  return this
}

module.exports = MeianSocket
