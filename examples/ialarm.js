
const constants = require('./src/constants')
const MeianSocket = require('./src/meian-socket')
const alarmStatus = require('./src/status-decoder')()
const DataHandler = require('./src/data-handler')

// we use this counter to delay concurrent executeCommand calls
let requestRunning = 0

function MeianClient (host, port, uid, pwd, zonesToQuery, logLevel, concurrentDelay) {
  const logger = require('./src/logger')(logLevel)

  concurrentDelay = concurrentDelay || 200

  const self = this

  // build zones array from max zone number
  if (zonesToQuery && !Array.isArray(zonesToQuery)) {
    const zonesSize = parseInt(zonesToQuery) || constants.listLimit.GetZone
    zonesToQuery = []
    for (let index = 0; index < zonesSize; index++) {
      const zoneNumber = index + 1 // zone 1, 2, etc
      zonesToQuery[zoneNumber] = zoneNumber
    }
  }

  /**
   * Opens connection, execute a specific command list and close the connection
   * @param {*} commands
   * @param {*} args
   * @param {*} listCallMax
   * @returns
   */
  async function executeCommand (commands, args, listCallMax) {
    requestRunning++
    let delay = (requestRunning * concurrentDelay) || 0
    // reset delay or instant commands
    if (delay > 10000 || commands.includes('SetAlarmStatus')) {
      requestRunning = 0
      delay = 0
      if (delay > 10000) {
        console.log(`High delay on commands "${JSON.stringify(commands)}" (${delay}ms): currently running ${requestRunning} requests, anyway delay is resetted to 0ms`)
      }
    }

    return new Promise((resolve, reject) => {
      if (delay) {
        console.log(`${JSON.stringify(commands)}: concurrent commands, delaying ${delay}ms`)
      }
      setTimeout(() => {
        const listLimits = {}
        commands.forEach(key => {
          listLimits[key] = listCallMax
        })
        const socket = MeianSocket(host, port, uid, pwd, logLevel, listLimits)
        // connect
        socket.connect()

        /**
         * ready to send commands
         */
        socket.onConnected(async (connectionResponse) => {
          // send commands
          await socket.executeCommand(commands, args)
        })

        /**
         * When it responds
         */
        socket.onResponse(async (commandResponse) => {
          // decrement request running
          requestRunning--
          if (requestRunning < 0) {
            requestRunning = 0
          }
          if (commandResponse) {
            resolve(commandResponse)
          } else {
            reject(commandResponse)
          }

          // done!
          socket.disconnect() // TODO non disconnettere in automatico ma far si che queste promise eseguano solo comandi una volta che la connessione è stata aperta
        })

        socket.onPush(async (response) => {
          // TODO SetByWay SetAlarmStatus SetArea producono notifiche Push di tipo Alarm
        })

        socket.onDisconnected(async (disconnectionResponse) => {
          logger.log('info', `disconnected (type: ${disconnectionResponse})`)
        })

        socket.onError(async (error) => {
          logger.log('error', `Error: ${JSON.stringify(error)})`)
        })
      }, delay)
    })
  }

  /**
   * Simple call for one command with its own data
   * @param {*} commandName
   * @param {*} dataTransform
   * @returns
   */
  async function singleFetch (commandNames, dataTransform, commandArgs, listCallMax, customError) {
    if (!Array.isArray(commandNames)) {
      commandNames = [commandNames]
    }
    const response = await executeCommand(commandNames, commandArgs, listCallMax)
    const firstCommand = commandNames[0]
    if (!response || !response[firstCommand]) {
      throw new Error(`${firstCommand} ${customError || 'returned empty data'}`)
    } else {
      if (dataTransform) {
        return dataTransform(response[firstCommand], response)
      }
      return response[firstCommand]
    }
  }

  /**
     * promise with simple response
     * @param {*} commands
     * @param {*} args
     * @returns
     */
  async function fetchWithSimpleResponse (commands, args) {
    const { data } = await executeCommand(commands, args)
    let response = {}
    if (Array.isArray(commands) && commands.length > 1) {
      commands.forEach(name => {
        response[name] = data[name]
      })
    } else {
      let key = commands
      if (Array.isArray(commands) && commands.length === 1) {
        key = commands[0]
      }
      response = data[key]
    }
    return response
  }

  /**
    * Networking config (ip, mac, etc) and alarm name
    */
  self.getNet = function () {
    return singleFetch('GetNet')
  }

  /**
   * Status: armed/disarmed/triggered for areas
   */
  self.getStatusArea = function () {
    return singleFetch(['GetArea', 'GetAlarmStatus'], DataHandler.getStatusArea)
  }

  /**
   * Alarm status: armed/disarmed/triggered and all sensors data with names
   */
  self.getStatusAlarm = async function () {
    return singleFetch('GetAlarmStatus', DataHandler.GetAlarmStatus)
  }

  /**
     * Full status: armed/disarmed/triggered and all sensors data with names
     */
  self.getFullStatus = function (zoneInfoCache) {
    return self.getZoneStatus(undefined, zoneInfoCache)
  }

  /**
     * Sensor status
     */
  self.getZoneStatus = function (status, zoneInfoCache) {
    const commands = ['GetByWay']
    // if needed fetch zones
    if (!zoneInfoCache) {
      commands.push('GetZone')
    }
    // if needed fetch status
    if (!status) {
      commands.push('GetAlarmStatus')
    }

    return singleFetch(commands, (data, { GetByWay, GetZone, GetAlarmStatus }) => {
      return DataHandler.getZoneStatus(status || GetAlarmStatus, GetByWay, zoneInfoCache || GetZone, zonesToQuery)
    })
  }

  /**
     * Arm Away
     */
  self.armAway = function (numArea) {
    return self.armDisarm('ARMED_AWAY', numArea)
  }

  /**
     * Arm home
     */
  self.armHome = function (numArea) {
    return self.armDisarm('ARMED_HOME', numArea)
  }

  /**
     * Arm home alias
     */
  self.armStay = function (numArea) {
    return self.armHome(numArea)
  }

  /**
     * Disarm
     */
  self.disarm = function (numArea) {
    return self.armDisarm('DISARMED', numArea)
  }

  /**
     * Cancel triggered status
     */
  self.cancel = function (numArea) {
    return self.armDisarm('CANCEL', numArea)
  }

  /**
     * generic arm disarm function
     * @param {*} requestedArmedStatus
     * @returns
     */
  self.armDisarm = function (requestedArmedStatus, numArea) {
    const numAreaIndex = numArea && numArea > 0 ? numArea - 1 : 0
    if (numAreaIndex > 0) {
      const value = alarmStatus.fromStatusToTcpValue(requestedArmedStatus)
      return fetchWithSimpleResponse(['SetArea'], [[numAreaIndex, value]])
    } else {
      const value = alarmStatus.fromStatusToTcpValue(requestedArmedStatus)
      return fetchWithSimpleResponse(['SetAlarmStatus'], [value])
    }
  }

  /**
     * Bypass/reset bypass zone
     * @param {*} number
     * @param {*} bypassed
     */
  self.bypassZone = function (zoneNumber, bypassed) {
    logger.info(`bypass zone ${zoneNumber}=${bypassed}`)
    return singleFetch('SetByWay',
      undefined, // no conversion
      [[zoneNumber - 1, bypassed]] // in tcp call zone is Zero-based numbering
    )
  }

  /**
   * Get all zones definition
   */
  self.getZoneInfo = function (zoneNumber) {
    return singleFetch('GetZone', (GetZone) => {
      return DataHandler.getZoneInfo(GetZone, zoneNumber)
    })
  }

  /**
   * Last 2 logged event (armed, disarmed, bypass, trigger, etc)
   * @returns
   */
  self.getLastEvents = function () {
    return singleFetch('GetLog',
      undefined, // no converter
      undefined, // no arg
      1 // just 1 call
    )
  }

  /**
     * Logged events (armed, disarmed, bypass, trigger, etc)
     * @returns
     */
  self.getEvents = function () {
    return singleFetch('GetLog')
  }

  /**
     * same as getZoneInfo without any zoneNumber
     * @returns
     */
  self.getAllZones = function () {
    return self.getZoneInfo()
  }

  /**
     * filter zones with relevant status
     * @param {*} zones
     * @returns
     */
  self.filterStatusZones = function (zones) {
    if (!zones) {
      return []
    }
    return zones.filter(function (zone) {
      return zone.status > 1
    })
  }

  return self
}

module.exports = MeianClient
