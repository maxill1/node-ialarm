
import Meianlogger from './meian-logger.js'
import MeianStatusDecoder from './meian-status-decoder.js'

const logger = Meianlogger('info')

/**
 * Manipulate data of multiple responses and add some custom logic to triggers
 */
const MeianDataHandler = {

  /**
   * handle both GetAlarmStatus and GetArea to generate the same status output
   * @param {*} data
   * @param {*} fullResponse
   * @returns
   */
  getStatus: (data, fullResponse) => {
    const response = {
      status_1: 'UNKNOWN',
      status_2: 'UNKNOWN',
      status_3: 'UNKNOWN',
      status_4: 'UNKNOWN'
    }
    if (typeof data === 'string' || (data.status && typeof data.status === 'string')) {
      const singleAreaStatus = data?.status ? data.status : data
      response.status_1 = singleAreaStatus
    } else if (data.areas && Array.isArray(data.areas)) {
      logger.debug(`Your alarm is exposing ${data.areas} areas`)
      // get area
      /*
     {  areas: [
    {
      id: 1,
      area: 1,
      value: 2,
      status: "ARMED_HOME",
    },
    {
      id: 2,
      area: 2,
      value: 1,
      status: "DISARMED",
    },
    {
      id: 3,
      area: 3,
      value: 1,
      status: "DISARMED",
    },
    {
      id: 4,
      area: 4,
      value: 1,
      status: "DISARMED",
    },
  ]}
      */

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
  mergeZonesInfo: function (zones, zonesInfo, zonesToQuery) {
    // return only filtered zones
    zones = MeianDataHandler.zoneFilter(zones || [], zonesToQuery)

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
   * Create a single payload using GetAlarmStatus|GetArea, GetByWay and GetZone responses. Optionally can filter zones
   * @param {*} GetAlarmStatusOrGetArea
   * @param {*} GetByWay
   * @param {*} GetZone
   * @param {*} zonesToQuery
   * @returns
   */
  getZoneStatus: (GetAlarmStatusOrGetArea, GetByWay, GetZone, zonesToQuery) => {
    const status = MeianDataHandler.getStatus(GetAlarmStatusOrGetArea)

    const zones = MeianDataHandler.mergeZonesInfo(
      GetByWay.zones,
      GetZone.zones,
      zonesToQuery)

    // zone triggered (after the merge we know the type)
    const triggeredArea = MeianStatusDecoder.getTriggeredArea(zones, status)
    triggeredArea.forEach(trigger => {
      const triggeredSensors = triggeredArea.map(a => `${a.zone.id} ${a.zone.name} ${a.area}`)
      logger.warn(`Alarm Area ${trigger.area} is ${JSON.stringify(status[trigger.area])} and triggered by zones: ${JSON.stringify(triggeredSensors)}`)
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
