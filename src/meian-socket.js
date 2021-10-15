
const convert = require('xml-js')
const net = require('net')
const { MeianMessage, MeianMessageFunctions } = require('./meian-message')
const EventEmitter = require('events')
const tcpResponseFormatters = require('./tcp-response-formatters')()
const constants = require('./constants')

class MeianEmitter extends EventEmitter { }

function MeianSocket (host, port, uid, pwd) {
  // default
  port = port || 18034

  const self = this

  const emitter = new MeianEmitter()

  // sequence for TCP requests
  let seq = 0
  // client status
  let socketStatus = 'disconnected'

  // list container
  let lists = {}
  const maxListCallSize = 100

  const socketTimeout = 10000

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

  self.executeCommand = function (commandNames, commandArgs) {
    const socket = new net.Socket()
    socket.setTimeout(socketTimeout)

    // multiple command execution
    let commandIndex = 0
    if (commandNames && !Array.isArray(commandNames)) {
      commandNames = [commandNames]
      commandArgs = [commandArgs]
    }

    /**
         * Disconnect from TCP socket
         */
    function disconnect () {
      if (socketStatus === 'connecting') {
        console.log(`${commandNames}: connection problem to ${host}:${port}???`)
      } else {
        console.log(`${commandNames}: disconnecting from ${host}:${port}`)
      }
      if (socket) {
        socketStatus = 'disconnecting'
        socket.destroy()
      }
      socketStatus = 'disconnected'
      emitter.emit('disconnected', { host, port })
    }

    /**
         * append the command to the tcp socket
         * @param {*} currentCommand
         * @param {*} currentArgs
         */
    function _writeCommand (currentCommand, currentArgs) {
      if (!currentArgs) {
        currentArgs = []
      } else if (!Array.isArray(currentArgs)) {
        currentArgs = [currentArgs]
      }
      const msg = MeianMessageFunctions[currentCommand](...currentArgs)
      // Send the login request
      seq = msg.seq
      if (msg.socketStatus) {
        socketStatus = msg.socketStatus
      }

      // Prepare an empty storage for the list/raw that will be used by all the events with different offsets
      if (msg.isList && (!msg.offset || msg.offset === 0 || !lists[currentCommand])) {
        lists[currentCommand] = {}
      }

      // call
      socket.write(msg.message)
    }

    /**
     * Parse the TCP alarm response buffer
     */
    function _receive (buffer) {
      let cmdName = ''
      return new Promise((resolve, reject) => {
        try {
          const raw = String.fromCharCode.apply(null, buffer)
          // console.log('Received RAW ' + raw);
          let xml = MeianMessage().extractMessage(raw)
          // console.log('Received XML ' + xml);
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
          // console.log('Received data: ', data);

          cmdName = _getCmdName(data)

          // TODO check errors
          if (data.Err && data.Err !== 'ERR|00') {
            emitter.emit('error', data.Err)
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
                _writeCommand(cmdName, newOffset)
              }
            } else {
              // not a list: we can emit the response
              done = true
            }

            if (done) {
              resolve({
                event: event,
                response: response
              })
            }
          }
        } catch (error) {
          reject(new Error(`${cmdName} ${error.message}`))
        }
      })
    }

    /**
         * resets emitter and socket listeners
         * resets the list data
         */
    function resetListeners () {
      // reset lists
      lists = {}
      // clear local emitter events
      socket.removeAllListeners()
      emitter.removeAllListeners()
    }

    return new Promise((resolve, reject) => {
      // Set up the timeout
      const timer = setTimeout(() => {
        disconnect()
        // sometimes the alarm hangs (bad tcp commands??)
        reject(new Error(`${commandNames}: meian socket timed out after ${socketTimeout} ms (your address/port may be wrong or the alarm may be hanging. Try connecting with your Android Phone, if not working either reboot the alarm and try again.)`))
      }, socketTimeout + 5000)

      socketStatus = 'connecting'

      socket.on('close', function () {
        console.log(`${commandNames}: Connection closed`)
        clearTimeout(timer)
        // reject(new Error(`${commandNames}: Connection closed`))
      })

      socket.on('error', function (error) {
        console.log(`${commandNames}: error ${error && error.message}`)
        clearTimeout(timer)
        reject(error)
      })

      // 2a) login accepted
      // or
      // 3a)command data resolved
      socket.on('data', function (data) {
        _receive(data).then(function (response) {
          // 2b)emitting custom event
          if (response.event === 'connected') {
            emitter.emit('meian-fetch', commandNames[commandIndex], commandArgs && commandArgs[commandIndex])
          } else {
            emitter.emit('meian-data', response)
            // emitter.emit(`meian-${response.event}`, response);
          }
        }, function (error) {
          disconnect()
          clearTimeout(timer)
          reject(error)
        })
      })

      const promiseData = {
        commandNames: commandNames,
        commandArgs: commandArgs,
        data: {}
      }

      // 2b) logged in, ready to send commands
      emitter.on('meian-fetch', function (currentCommand, currentArgs) {
        // this will write new data to tcp server and client will emit new 'data' events 3a)
        if (currentCommand && MeianMessageFunctions[currentCommand]) {
          _writeCommand(currentCommand, currentArgs)
        } else {
          // no command to execute, or we are done
          disconnect()
          // reset timeout
          clearTimeout(timer)
          // reset emitter listeners
          resetListeners()
          // resolving the promise
          resolve(promiseData)
        }
      })

      // 3a) logged in, ready to send commands
      emitter.on('meian-data', function (data) {
        // check data integrity
        const current = commandNames[commandIndex]
        if (data.event === current) {
          // same event and command
          promiseData.data[current] = data.response
        } else {
          // should never happen
          promiseData.data[current] = data
        }

        // if last command, resolve
        commandIndex++
        if (!commandNames[commandIndex]) {
          // done: data is received and formatted by _receive
          disconnect()
          // reset timeout
          clearTimeout(timer)
          // reset emitter listeners
          resetListeners()
          // resolving the promise
          resolve(promiseData)
        } else {
          // next
          emitter.emit('meian-fetch', commandNames[commandIndex], commandArgs && commandArgs[commandIndex])
        }
      })

      console.log(`${commandNames}: connecting to ${host}:${port}`)
      // 1) connect and send login data
      socket.connect(port, host, function () {
        console.log(`${commandNames}: connected to ${host}:${port}`)

        // Send the login request
        const loginMsg = MeianMessageFunctions.Client(uid, pwd)
        seq = loginMsg.seq
        socketStatus = loginMsg.socketStatus
        socket.write(loginMsg.message)
      })
    })
  }

  return self
}

module.exports = MeianSocket
