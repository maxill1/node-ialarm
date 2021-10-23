
const constants = require('./src/constants')
const MeianSocket = require('./src/meian-socket')
const alarmStatus = require('./src/status-decoder')()

// we use this counter to delay concurrent executeCommand calls
let requestRunning = 0

function MeianClient (host, port, uid, pwd, zonesToQuery, logLevel, concurrentDelay) {
  const logger = require('./src/logger')(logLevel)

  concurrentDelay = concurrentDelay || 200

  const self = this

  // build zones array from max zone number
  if (zonesToQuery && !Array.isArray(zonesToQuery)) {
    const zonesSize = parseInt(zonesToQuery) || constants.maxZones
    zonesToQuery = []
    for (let index = 0; index < zonesSize; index++) {
      const zoneNumber = index + 1 // zone 1, 2, etc
      zonesToQuery[zoneNumber] = zoneNumber
    }
  }

  /**
     * Filter configured zones
     * @param {*} zones
     * @returns
     */
  function zoneFilter (zones) {
    if (zonesToQuery && Array.isArray(zonesToQuery) && Array.isArray(zones)) {
      return zones.filter(z => zonesToQuery.includes(z.id))
    }
    return zones
  }

  function executeCommand (commands, args, listCallMax) {
    requestRunning++
    const delay = requestRunning * concurrentDelay
    return new Promise((resolve, reject) => {
      console.log(`${JSON.stringify(commands)}: concurrent commands, delaying ${delay}ms`)
      setTimeout(() => {
        MeianSocket(host, port, uid, pwd, logLevel).executeCommand(commands, args, listCallMax)
          .then(resolve)
          .catch(reject).finally(() => {
            requestRunning--
            if (requestRunning < 0) {
              requestRunning = 0
            }
          })
      }, delay)
    })
  }

  /**
    * Networking config (ip, mac, etc) and alarm name
    */
  self.getNet = function () {
    return new Promise((resolve, reject) => {
      return executeCommand('GetNet').then(function ({ data }) {
        const { GetNet } = data
        if (!GetNet) {
          reject(new Error('GetNet returned empty data'))
        }
        resolve(GetNet)
      }).catch((e) => {
        reject(e)
      })
    })
  }

  /**
   * Status: armed/disarmed/triggered for areas
   */
  self.getStatusArea = function () {
    return new Promise((resolve, reject) => {
      const commands = ['GetArea']
      return executeCommand(commands).then(function ({ data }) {
        const { GetArea } = data

        const response = {
          // status_1: "",
          // status_2: ""
        }
        if (!GetArea || !GetArea.area) {
          logger.warn('Your alarm is not exposing any areas with GetArea, use GetAlarmStatus instead')
          self.getStatusAlarm().then((singleAreaStatus) => {
            resolve({
              status_1: singleAreaStatus.status,
              status_2: singleAreaStatus.status,
              status_3: singleAreaStatus.status,
              status_4: singleAreaStatus.status
            })
          }).catch((e) => {
            reject(e)
          })
        } else {
          data && data.GetArea.forEach(item => {
            response[`status_${item.area}`] = item.status
          })
          resolve(response)
        }
      }).catch((e) => {
        reject(e)
      })
    })
  }

  /**
   * Alarm status: armed/disarmed/triggered and all sensors data with names
   */
  self.getStatusAlarm = function () {
    return new Promise((resolve, reject) => {
      const commands = ['GetAlarmStatus']
      return executeCommand(commands).then(function ({ data }) {
        const { GetAlarmStatus } = data
        if (!GetAlarmStatus || !GetAlarmStatus) {
          reject(new Error('GetAlarmStatus returned empty data'))
        }
        resolve({
          status: GetAlarmStatus // we will not observe "TRIGGERED" here
        })
      }).catch((e) => {
        reject(e)
      })
    })
  }

  /**
     * Full status: armed/disarmed/triggered and all sensors data with names
     */
  self.getFullStatus = function (zoneInfoCache) {
    return new Promise((resolve, reject) => {
      const commands = ['GetAlarmStatus']
      return executeCommand(commands).then(function ({ data }) {
        const { GetAlarmStatus } = data
        // sensor status with names, type, etc
        self.getZoneStatus(GetAlarmStatus, zoneInfoCache).then(function (GetByWay) {
          if (!GetByWay || !GetByWay.zones) {
            reject(new Error('GetByWay returned empty data'))
          } else {
            const response = {
              // alarm triggered status is derived from zones alarm
              status: GetByWay.status || GetAlarmStatus,
              zones: GetByWay.zones
            }
            resolve(response)
          }
        }, function (error) {
          logger.error(`getZoneStatus returned error: ${JSON.stringify(error)}. Returning alarm status ${GetAlarmStatus} and omitting zones`)
          // we want to return alarm status anyway
          resolve({
            // alarm triggered status is derived from zones alarm
            status: GetAlarmStatus,
            zones: [] // no zone data
          })
        })
      }).catch((e) => {
        reject(e)
      })
    })
  }

  /**
     * Sensor status
     */
  self.getZoneStatus = function (status, zoneInfoCache) {
    function mergeZonesInfo (zones, zonesInfo, stat) {
      if (zones && zonesInfo) {
        for (let index = 0; index < zones.length; index++) {
          const zone = zones[index]
          const info = zonesInfo.find(z => z.id === zone.id)
          // merge
          zones[index] = {
            ...zone,
            ...info
          }
        }
      }

      // zone triggered (this time we have zone typeId for 24 hours zones)
      if (alarmStatus.isTriggered(zones, status)) {
        stat = alarmStatus.fromTcpValueToStatus('4')
      }
      return {
        zones: zones,
        status: stat
      }
    }

    return new Promise((resolve, reject) => {
      return executeCommand('GetByWay').then(function ({ data }) {
        const { GetByWay } = data
        if (!GetByWay) {
          reject(new Error('GetByWay returned empty data'))
        } else {
          let response = {
            // return only filtered zones
            zones: zoneFilter(GetByWay.zones),
            // zone triggered (ignoring typeId - this wont return triggered for 24 hours zone)
            status: alarmStatus.isTriggered(GetByWay.zones, status) ? alarmStatus.fromTcpValueToStatus('4') : status
          }

          if (zoneInfoCache) {
            response = mergeZonesInfo(response.zones, zoneInfoCache, response.status)
            // return only the zone status without zone info (type, name, etc)
            resolve(response)
          } else {
            // fetch names and other configuration info
            self.getZoneInfo().then(function (GetZone) {
              if (!GetZone) {
                reject(new Error('GetZone returned empty data'))
              } else {
                response = mergeZonesInfo(response.zones, GetZone, response.status)
                resolve(response)
              }
            }, function (error) {
              // we will return what we have...
              logger.error(`getZoneInfo returned error: ${JSON.stringify(error)}. Returning alarm status ${response.status} and zones without config info`)
              resolve(response)
            })
          }
        }
      }).catch((e) => {
        reject(e)
      })
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
     * promise with simple response
     * @param {*} commands
     * @param {*} args
     * @returns
     */
  function PromiseWithSimpleResponse (commands, args) {
    return new Promise((resolve, reject) => {
      executeCommand(commands, args).then(function ({ data }) {
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
        resolve(response)
      }).catch(function (err) {
        reject(err)
      })
    })
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
      return PromiseWithSimpleResponse(['SetArea'], [[numAreaIndex, value]])
    } else {
      const value = alarmStatus.fromStatusToTcpValue(requestedArmedStatus)
      return PromiseWithSimpleResponse(['SetAlarmStatus'], [value])
    }
  }

  /**
     * Bypass/reset bypass zone
     * @param {*} number
     * @param {*} bypassed
     */
  self.bypassZone = function (zoneNumber, bypassed) {
    logger.info(`bypass zone ${zoneNumber}=${bypassed}`)
    // in tcp call zone is Zero-based numbering
    return PromiseWithSimpleResponse(['SetByWay'], [[zoneNumber - 1, bypassed]])
  }

  /**
     * Get all zones definition
     */
  self.getZoneInfo = function (zoneNumber) {
    return new Promise((resolve, reject) => {
      executeCommand(['GetZone']).then(function (response) {
        if (response && response.data && response.data.GetZone) {
          const zones = response.data.GetZone.zones
          if (zoneNumber) {
            const info = zones.find(z => z.id === zoneNumber)
            if (info) {
              return info
            }
          }
          resolve(zoneFilter(zones))
        } else {
          reject(new Error('GetZone returned no data'))
        }
      }).catch((e) => {
        reject(e)
      })
    })
  }

  /**
     * Last 2 logged event (armed, disarmed, bypass, trigger, etc)
     * @returns
     */
  self.getLastEvents = function () {
    return PromiseWithRetry(
      ['GetLog'], // events
      undefined, // no arg
      1, // just 1 call
      true
    )
  }

  /**
     * Logged events (armed, disarmed, bypass, trigger, etc)
     * @returns
     */
  self.getEvents = function () {
    return PromiseWithRetry(['GetLog'], undefined, undefined, true)
  }

  /**
     * promise with simple response
     * @param {*} commands
     * @param {*} args
     * @returns
     */
  function PromiseWithRetry (commands, args, listCallMax, retry) {
    return new Promise((resolve, reject) => {
      executeCommand(commands, args, listCallMax).then(function ({ data }) {
        let response = {}

        // received a push notification by error...
        if ((data.Alarm || data.Client) && retry) {
          // weird "push" responses...
          // retry
          setTimeout(() => {
            logger.warning(`Received an "${data.Alarm ? 'Alarm' : 'Client'}" response instead of ${JSON.stringify(commands)}. Retrying...`)
            PromiseWithRetry(commands, args, listCallMax, false).then((retryResponse) => {
              resolve(retryResponse)
            }).catch((e) => {
              reject(e)
            })
          }, 500)
        } else {
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
          // if (!data[cmd]) {
          //   reject(new Error(`${cmd} returned no data`))
          // }

          resolve(response)
        }
      }).catch(function (err) {
        reject(err)
      })
    })
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
