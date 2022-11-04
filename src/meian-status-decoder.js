const statusTcp = {
  0: ['ARMED_AWAY', 'armAway', 'armedAway'],
  1: ['DISARMED', 'disarm', 'disarmed'],
  2: ['ARMED_HOME', 'armHome', 'armedHome'], // ARMED_STAY
  3: ['CANCEL', 'cancel'], // CLEAR
  4: ['TRIGGERED', 'triggered', 'trigger'] // fake status, alarm is not reporting this. It's triggered when one of the zones reports "alarm"
}

const _fromValue = function (value, list) {
  const statuses = list[value]
  if (statuses && statuses[0]) {
    // always first value, since this is an alias
    return statuses[0]
  }
  throw new Error('unknown status')
}

const _fromStatus = function (st, list) {
  for (const value in list) {
    const statuses = list[value]
    if (statuses.includes(st)) {
      return value
    }
  }
  throw new Error('unknown status')
}

const MeianStatusDecoder = {

  isArmed: function (statusValue) {
    return ['ARMED_HOME', 'ARMED_AWAY'].includes(statusValue)
  },

  /**
   *  Alarm is triggered if armed and one of the zones is alarmed, or if any state but a 24 hours zone (type=5) is alarmed
   */
  getTriggeredArea: function (zones, GetAlarmStatus) {
    const triggered = []
    const armed = []

    // GetArea/GetAlarmStatus
    if ((typeof GetAlarmStatus === 'string' || !GetAlarmStatus.status_1)) {
      if (MeianStatusDecoder.isArmed(GetAlarmStatus)) {
        armed.push('status_1')
      }
    } else {
      // H24 triggered or armed and zone alarm goes on area 1 (until we find a way to determine sensor area)
      Object.keys(GetAlarmStatus).forEach(statusArea => {
        const areaStatus = GetAlarmStatus[statusArea]
        if (areaStatus && MeianStatusDecoder.isArmed(areaStatus)) {
          armed.push(statusArea)
        }
      })
    }

    // zone triggered with alarm or 24 hour type (5)
    if (zones) {
      zones.forEach(z => {
        // triggered zone
        if (z.alarm) {
          // TODO H24 triggered or armed and zone alarm goes on area 1 (until we find a way to determine sensor area)
          if (z.typeId === 5) {
            triggered.push({
              zone: z,
              area: 'status_1'
            })
          } else {
            // search for any armed area
            armed.forEach(area => {
              // TODO ask someone with GetArea to check if GetByWay exposes any param that correlate an area to a the zone, for now the are all related to area 1
              if (area === 'status_1') {
                triggered.push({
                  zone: z,
                  area
                })
              }
            })
          }
        }
      })
    }
    return triggered
  },

  /**
   * Alarm is triggered if armed and one of the zones is alarmed, or if any state but a 24 hours zone (type=5) is alarmed
   * @param {*} zones
   * @param {*} alarmStatus
   * @returns
   */
  isTriggered: function (zones, GetAlarmStatus) {
    return MeianStatusDecoder.getTriggeredArea(zones, GetAlarmStatus).length > 0
  },

  fromTcpValueToStatus: function (value) {
    return _fromValue(value, statusTcp)
  },

  fromStatusToTcpValue: function (st) {
    return _fromStatus(st, statusTcp)
  },

  getZoneStatus: function (zoneStatus) {
    const ZONE_NOT_USED = 0
    const ZONE_IN_USE = (1 << 0)
    const ZONE_ALARM = (1 << 1)
    const ZONE_BYPASS = (1 << 2)
    const ZONE_FAULT = (1 << 3)
    const ZONE_LOW_BATTERY = (1 << 4)
    const ZONE_LOSS = (1 << 5)

    const zone = {}
    zone.inUse = false
    zone.ok = true
    zone.alarm = false
    zone.bypass = false
    zone.lowbat = false
    zone.fault = false
    zone.wirelessLoss = false

    if (zoneStatus & ZONE_NOT_USED) {
      // console.log(`${zone.id}=ZONE_NOT_USED`);
      zone.inUse = false
    }
    if (zoneStatus & ZONE_IN_USE) {
      // console.log(`${zone.id}=ZONE_IN_USE`);
      zone.inUse = true
    }
    if (zoneStatus & ZONE_ALARM) {
      // console.log(`${zone.id}=ZONE_ALARM`);
      zone.alarm = true
      zone.message = 'Alarm'
    }
    if (zoneStatus & ZONE_BYPASS) {
      // console.log(`${zone.id}=ZONE_BYPASS`);
      zone.bypass = true
      zone.message = 'Bypassed'
    }
    if (zoneStatus & ZONE_FAULT) {
      // console.log(`${zone.id}=ZONE_FAULT`);
      zone.fault = true
      zone.message = 'Fault'
    }
    if (zoneStatus & ZONE_LOW_BATTERY) {
      // console.log(`${zone.id}=ZONE_LOW_BATTERY`);
      zone.lowbat = true
      zone.message = 'Low Battery'
    }
    if (zoneStatus & ZONE_LOSS) {
      // console.log(`${zone.id}=ZONE_LOSS`);
      zone.wirelessLoss = true
      zone.message = 'Wireless lost'
    }

    zone.ok = !zone.alarm &&
            !zone.alarm &&
            !zone.fault &&
            !zone.lowbat &&
            !zone.loss

    // problem = easy check !ok in clients
    zone.problem = !zone.ok

    if (zone.ok) {
      zone.message = 'OK'
    }
    return zone
  }

  // 3 alarm
  // 11=alarm & fault

  /*
    zoneStatus: {
        1: {
            bypass: false,
            open: false,
            fault: false,
            alarm: false,
            lowbat: false,
            message: 'OK'
        },
        5: {
            bypass: true,
            open: false,
            fault: false,
            alarm: false,
            lowbat: false,
            message: 'Bypassed'
        },
        9: {
            bypass: false,
            open: false,
            fault: true,
            alarm: false,
            lowbat: false,
            message: 'Fault'
        },
        13: {
            bypass: true,
            open: false,
            fault: true,
            alarm: false,
            lowbat: false,
            message: 'Bypassed and fault'
        },
        //TODO more statuses
    }
    */

}

export default MeianStatusDecoder
