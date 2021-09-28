
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

    return this;
}