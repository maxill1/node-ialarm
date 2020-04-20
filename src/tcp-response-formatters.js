
const alarmStatus = require('./status-decoder')();
module.exports = function () {

    this.GetAlarmStatus = function (data) {
        console.log("Formatting GetAlarmStatus response");
        var status = data.DevStatus._text;
        var match = new RegExp(/TYP,(\w+)\|(\d+)/).exec(status);
        return alarmStatus.fromTcpValueToStatus(match[2]);
    }

    return this;
}