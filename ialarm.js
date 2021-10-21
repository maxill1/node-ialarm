
const constants = require('./src/constants')
const MeianSocket = require('./src/meian-socket')
const alarmStatus = require('./src/status-decoder')()

function MeianClient (host, port, uid, pwd, zonesToQuery) {
  const self = this

  const socket = MeianSocket(host, port, uid, pwd)

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

  /**
    * Networking config (ip, mac, etc) and alarm name
    */
  self.getNet = function () {
    return new Promise((resolve, reject) => {
      return socket.executeCommand('GetNet').then(function ({ data }) {
        const { GetNet } = data
        if (!GetNet) {
          reject(new Error('GetNet returned empty data'))
        }
        resolve(GetNet)
      }, function (err) {
        reject(err)
      })
    })
  }

  /**
     * Full status: armed/disarmed/triggered and all sensors data with names
     */
  self.getStatus = function (zoneInfoCache) {
    return new Promise((resolve, reject) => {
      const commands = ['GetAlarmStatus']
      return socket.executeCommand(commands).then(function ({ data }) {
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
          console.error(`getZoneStatus returned error: ${JSON.stringify(error)}. Returning alarm status ${GetAlarmStatus} and omitting zones`)
          // we want to return alarm status anyway
          resolve({
            // alarm triggered status is derived from zones alarm
            status: GetAlarmStatus,
            zones: [] // no zone data
          })
        })
      }, function (err) {
        reject(err)
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
      return socket.executeCommand('GetByWay').then(function ({ data }) {
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
              console.error(`getZoneInfo returned error: ${JSON.stringify(error)}. Returning alarm status ${response.status} and zones without config info`)
              resolve(response)
            })
          }
        }
      }, function (err) {
        reject(err)
      })
    })
  }

  /**
     * Arm Away
     */
  self.armAway = function () {
    return self.armDisarm('ARMED_AWAY')
  }

  /**
     * Arm home
     */
  self.armHome = function () {
    return self.armDisarm('ARMED_HOME')
  }

  /**
     * Arm home alias
     */
  self.armStay = function () {
    return self.armHome()
  }

  /**
     * Disarm
     */
  self.disarm = function () {
    return self.armDisarm('DISARMED')
  }

  /**
     * Cancel triggered status
     */
  self.cancel = function () {
    return self.armDisarm('CANCEL')
  }

  /**
     * promise with command execution and full status response
     * @param {*} commands
     * @param {*} args
     * @returns
     */
  function MeianPromiseWithStatusResponse (commands, args) {
    return new Promise((resolve, reject) => {
      console.log('requesting ' + commands + ' with args ' + args)
      socket.executeCommand(commands, args).then(function (commandResponse) {
        console.log(commandResponse)
        self.getStatus().then(function (response) {
          if (response) {
            resolve(response)
          } else {
            reject(new Error('getStatus returned no data'))
          }
        }, function (err) {
          reject(err)
        })
      }, function (err) {
        reject(err)
      })
    })
  }

  /**
     * generic arm disarm function
     * @param {*} requestedArmedStatus
     * @returns
     */
  self.armDisarm = function (requestedArmedStatus) {
    const value = alarmStatus.fromStatusToTcpValue(requestedArmedStatus)
    return MeianPromiseWithStatusResponse(['SetAlarmStatus'], [value])
  }

  /**
     * Bypass/reset bypass zone
     * @param {*} number
     * @param {*} bypassed
     */
  self.bypassZone = function (zoneNumber, bypassed) {
    console.log('bypass zone ' + zoneNumber + '=' + bypassed)
    // in tcp call zone is Zero-based numbering
    return MeianPromiseWithStatusResponse(['SetByWay'], [[zoneNumber - 1, bypassed]])
  }

  /**
     * Get all zones definition
     */
  self.getZoneInfo = function (zoneNumber) {
    return new Promise((resolve, reject) => {
      socket.executeCommand(['GetZone']).then(function (response) {
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
      }, function (err) {
        reject(err)
      })
    })
  }

  /**
     * Logged events (armed, disarmed, etc)
     * @returns
     */
  self.getEvents = function () {
    return new Promise((resolve, reject) => {
      socket.executeCommand(['GetLog']).then(function ({ data }) {
        if (data && data.GetLog && data.GetLog.logs) {
          resolve(data.GetLog.logs)
        } else {
          reject(new Error('GetLog returned no data'))
        }
      }, function (err) {
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
