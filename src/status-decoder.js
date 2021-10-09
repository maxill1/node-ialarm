
module.exports = function () {
    const statusScraper = {
        '1': 'ARMED_AWAY',
        '2': 'ARMED_HOME', //ARMED_STAY
        '3': 'DISARMED',
        '4': 'CANCEL',
        '5': 'TRIGGERED'
    }

    const statusTcp = {
        '0': 'ARMED_AWAY',
        '1': 'DISARMED',
        '2': 'ARMED_HOME', //ARMED_STAY
        '3': 'CANCEL',  //CLEAR
        '4': 'TRIGGERED' //TODO
    }

    var _fromValue = function (value, list) {
        let st = list[value];
        if (!list[value]) {
            //console.log("Unknown status for "+value);
            throw 'unknown status';
        }
        //console.log("Found status :" + st + "("+value+")");
        return st;
    }

    var _fromStatus = function (st, list) {
        for (let value in list) {
            if (list[value] === st) {
                return value;
            }
        }
        throw 'unknown status';
    }


    this.fromScraperValueToStatus = function (value) {
        return _fromValue(value, statusScraper);
    }

    this.fromStatusToScraperValue = function (st) {
        return _fromStatus(st, statusScraper);
    }


    this.fromTcpValueToStatus = function (value) {
        return _fromValue(value, statusTcp);
    }

    this.fromStatusToTcpValue = function (st) {
        return _fromStatus(st, statusTcp);
    }


    const ZONE_NOT_USED = 0
    const ZONE_IN_USE = (1 << 0)
    const ZONE_ALARM = (1 << 1)
    const ZONE_BYPASS = (1 << 2)
    const ZONE_FAULT = (1 << 3)
    const ZONE_LOW_BATTERY = (1 << 4)
    const ZONE_LOSS = (1 << 5)

    this.getZoneStatus = function (zoneStatus) {

        const zone = {}
        zone.inUse = false;
        zone.ok = true;
        zone.alarm = false;
        zone.bypass = false;
        zone.lowbat = false;
        zone.fault = false;
        zone.wirelessLoss = false;

        if (zoneStatus & ZONE_NOT_USED) {
            //console.log(`${zone.id}=ZONE_NOT_USED`);
            zone.inUse = false;
        }
        if (zoneStatus & ZONE_IN_USE) {
            //console.log(`${zone.id}=ZONE_IN_USE`);
            zone.inUse = true;
        }
        if (zoneStatus & ZONE_ALARM) {
            //console.log(`${zone.id}=ZONE_ALARM`);
            zone.alarm = true;
            zone.message = "Alarm"
        }
        if (zoneStatus & ZONE_BYPASS) {
            //console.log(`${zone.id}=ZONE_BYPASS`);
            zone.bypass = true;
            zone.message = 'Bypassed';
        }
        if (zoneStatus & ZONE_FAULT) {
            //console.log(`${zone.id}=ZONE_FAULT`);
            zone.fault = true;
            zone.message = 'Fault'
        }
        if (zoneStatus & ZONE_LOW_BATTERY) {
            //console.log(`${zone.id}=ZONE_LOW_BATTERY`);
            zone.lowbat = true;
            zone.message = 'Low Battery'
        }
        if (zoneStatus & ZONE_LOSS) {
            //console.log(`${zone.id}=ZONE_LOSS`);
            zone.wirelessLoss = true;
            zone.message = 'Wireless lost'
        }

        zone.ok = !zone.alarm
            && !zone.alarm
            && !zone.fault
            && !zone.lowbat
            && !zone.loss;

        //problem = easy check !ok in clients
        zone.problem = !zone.ok;

        if (zone.ok) {
            zone.message = 'OK';
        }
        return zone;
    }

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

    return this;
}