
import Meianlogger from './meian-logger.js'
import MeianStatusDecoder from './meian-status-decoder.js'

const logger = Meianlogger('info')

/**
 * Manipulate data of multiple responses and add some custom logic to triggers
 */
const MeianDataHandler = {
  getStatusAlarm: (data, _fullResponse) => {
    return {
      status: data // we will not observe "TRIGGERED" here
    }
  },
  getStatusArea: (data, fullResponse) => {
    const response = {
      // status_1: "",
      // status_2: ""
    }

    if ((!data || !data.areas || data.areas.length === 0) && fullResponse.GetAlarmStatus) {
      logger.warn('Your alarm is not exposing any areas with GetArea, use GetAlarmStatus instead')
      const singleAreaStatus = fullResponse.GetAlarmStatus
      return {
        status_1: singleAreaStatus,
        status_2: singleAreaStatus,
        status_3: singleAreaStatus,
        status_4: singleAreaStatus
      }
    } else {
      data.areas.forEach(item => {
        response[`status_${item.area}`] = item.status
      })
    }

    return response
  },
  /**
   * Merge GetAlarmStatus GetZone and GetByWay data into a single list
   * @param {*} zones
   * @param {*} zonesInfo
   * @param {*} stat
   * @returns
   */
  mergeZonesInfo: function (zones, zonesInfo) {
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

    return zones
  },
  /**
     * Filter configured zones
     * @param {*} zones
     * @returns
     */
  zoneFilter: (zones, zonesToQuery) => {
    if (zonesToQuery && Array.isArray(zonesToQuery) && Array.isArray(zones)) {
      return zones.filter(z => zonesToQuery.includes(z.id))
    }
    return zones
  },
  /**
   * Create a single payload using GetAlarmStatus, GetByWay and GetZone responses. Optionally can filter zones
   * @param {*} GetAlarmStatus
   * @param {*} GetByWay
   * @param {*} GetZone
   * @param {*} zonesToQuery
   * @returns
   */
  getZoneStatus: (GetAlarmStatus, GetByWay, GetZone, zonesToQuery) => {
    let status = GetAlarmStatus
    // GetAlarmStatus/GetArea
    if (typeof GetAlarmStatus === 'string') {
      status = {
        status_1: GetAlarmStatus
      }
    }

    const zones = MeianDataHandler.mergeZonesInfo(
      // return only filtered zones
      MeianDataHandler.zoneFilter(GetByWay.zones, zonesToQuery),
      GetZone.zones)

    // zone triggered (after the merge we know the type)
    const triggeredArea = MeianStatusDecoder.getTriggeredArea(zones, status)
    triggeredArea.forEach(trigger => {
      const triggeredSensors = triggeredArea.map(a => `${a.zone.id} ${a.zone.name} ${a.area}`)
      logger.warn(`Alarm ${trigger.area} is ${JSON.stringify(GetAlarmStatus[trigger.area])} and triggered by zones: ${JSON.stringify(triggeredSensors)}`)
      // set to triggered
      status[trigger.area] = MeianStatusDecoder.fromTcpValueToStatus('4')
    })

    return {
      zones,
      status
    }
  },
  /**
   * Zone info with filter on number
   * @param {*} GetZone
   * @param {*} zoneNumber
   * @returns
   */
  getZoneInfo: (GetZone, zoneNumber) => {
    const zones = GetZone.zones
    if (zoneNumber) {
      const info = zones.find(z => z.id === zoneNumber)
      if (info) {
        return info
      }
    }
    return MeianDataHandler.zoneFilter(zones)
  }

}

export default MeianDataHandler
