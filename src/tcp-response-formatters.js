
const alarmStatus = require('./status-decoder')();
const constants = require('./constants');
module.exports = function () {

    const TYPES = /BOL|DTA|ERR|GBA|HMA|IPA|MAC|NEA|NUM|PWD|S32|STR|TYP/;
    const BOL = /BOL\|([FT])/;
    const DTA = /DTA(,\d+)*\|(\d{4}\.\d{2}.\d{2}.\d{2}.\d{2}.\d{2})/;
    const ERR = /ERR\|(\d{2})/;
    const GBA = /GBA,(\d+)\|([0-9A-F]*)/;
    const HMA = /HMA,(\d+)\|(\d{2}:\d{2})/;
    const IPA = /IPA,(\d+)\|(([0-2]?\d{0,2}\.){3}([0-2]?\d{0,2}))/;
    const MAC = /MAC,(\d+)\|(([0-9A-F]{2}[:-]){5}([0-9A-F]{2}))/;
    const NEA = /NEA,(\d+)\|([0-9A-F]+)/;
    const NUM = /NUM,(\d+),(\d+)\|(\d*)/;
    const PWD = /PWD,(\d+)\|(.*)/;
    const S32 = /S32,(\d+),(\d+)\|(\d*)/
    const STR = /STR,(\d+)\|(.*)/;
    const TYP = /TYP,(\w+)\|(\d+)/;

    /**
     * get index from a line node (L0, L1, L2, L3, etc)
     * @param {*} key 
     */
    const _getLineNumber = function (key) {
        var regRows = key.match(/L(\d{1,2})/);
        if (regRows && regRows.length > 0) {
            var index = parseInt(regRows[1]);
            if (!isNaN(index)) {
                return index;
            }
        }
        return null;
    }


    /**
     * When multiple messages are neede to get a full list, this function will handle the parsing and push
     */
    const _parseListableData = function (listName, current, container, lineParser) {
        //creating raw array and formatted list
        if (!container.raw) {
            container.raw = []
        }
        container.raw.push(current);

        if (!container[listName]) {
            container[listName] = []
        }

        for (const key in current) {
            const element = current[key];
            //extract L0, L1, etc and add them to the list in the container
            _listBasedFormatter(key, element, container, listName, lineParser, true);
        }
    }

    /**
     * parses a line based response
     * @param {*} key current iterated key
     * @param {*} element xml element value
     * @param {*} data the response object
     * @param {*} listName the name of the list containing lines (events, logs, etc)
     */
    const _listBasedFormatter = function (key, value, data, listName, rowFormatter, push) {
        var lineNumber = _getLineNumber(key);
        if (lineNumber !== null && rowFormatter) {
            const row = rowFormatter(value, key, lineNumber);
            if (!data[listName]) {
                data[listName] = [];
            }
            if (push) {
                data[listName].push(row);
            } else {
                data[listName][lineNumber] = row;
            }

        }

    }

    /** 
     * cleanup the response
     */
    this.cleanData = function (input) {
        var value = input;
        var type = TYPES.exec(input) && TYPES.exec(input)[0];
        if (!type) {
            console.log(`No type found for ${input}`);
        }

        switch (type) {
            case 'BOL':
                var bol = BOL.exec(input)[1];
                if (bol == "T") {
                    value = true
                }
                if (bol == "F") {
                    value = false
                }
                break;
            case 'DTA':
                //2020.06.04.18.40.03
                var dta = DTA.exec(input)[2].split('.')
                value = new Date(Date.UTC(dta[0], dta[1], dta[2], dta[3], dta[4], dta[5]));
                break;
            case 'ERR':
                value = parseInt(ERR.exec(input)[0])
                break;
            case 'GBA':
                var bytes = GBA.exec(input)[2];

                var hex_to_ascii = function (str1) {
                    var hex = str1.toString();
                    var str = '';
                    for (var n = 0; n < hex.length; n += 2) {
                        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
                    }
                    return str;
                }
                value = hex_to_ascii(bytes);
                break;
            case 'HMA':
                var hma = HMA.exec(input)[1]
                value = time.strptime(hma, '%H:%M')
                break;
            case 'IPA':
                value = String(IPA.exec(input)[1])
                break;
            case 'MAC':
                value = String(MAC.exec(input)[1])
                break;
            case 'NEA':
                value = String(NEA.exec(input)[1])
                break;
            case 'NUM':
                value = String(NUM.exec(input)[2])
                break;
            case 'PWD':
                value = String(PWD.exec(input)[1])
                break;
            case 'S32':
                value = parseInt(S32.exec(input)[3])
                break;
            case 'STR':
                value = String(STR.exec(input)[2])
                break;
            case 'TYP':
                value = parseInt(TYP.exec(input)[2]);
                break;
            default:
                console.log(`No type found for ${input}`);
                break;
        }

        return value;
    }

    this.GetAlarmStatus = function (data) {
        console.log("Formatting GetAlarmStatus response");
        var status = data.DevStatus.value;
        var exec = TYP.exec(status);
        return alarmStatus.fromTcpValueToStatus(exec[2]);
    }

    this.GetByWay = function (data) {
        console.log("Formatting GetByWay response");

        var response = {
            zones: [],
            raw: data
        };
        for (const key in data) {
            const element = data[key];
            if (element.value) {
                const value = this.cleanData(element.value);
                _listBasedFormatter(key, value, response, 'zones', function (lineValue, key, lineNumber) {
                    var zone = {};
                    zone.id = lineNumber + 1;
                    zone.name = key;
                    zone.status = lineValue;
                    //fault, alarm, bypass, etc
                    var statusData = constants.zoneStatus[lineValue];
                    if (statusData) {
                        for (const key in statusData) {
                            zone[key] = statusData[key];
                        }
                    }
                    return zone;
                });
            }
        }
        return response;
    }

    /**
     * Get zone info
     */
    this.GetZone = function (current, container) {
        console.log("Formatting GetZone response");

        _parseListableData('zones', current, container, function (lineValue) {
            var line = {};
            line.Name = this.cleanData(lineValue.Name.value);
            line.Type = this.cleanData(lineValue.Type.value);
            line.Voice = this.cleanData(lineValue.Voice.value);
            return line;
        });

        return container;
    }

    /**
     * List of events recorded in the alarm (arm, disarm, bypass, alert, etc)
     */
    this.GetLog = function (current, container) {
        console.log("Formatting GetLog response");
        /*
        raw format
        "L1": { "Time": { "value": "DTA,19|2020.06.04.18.35.15" }, 
                "Area": { "value": "S32,1,40|16" }, 
                 "Event": { "value": "STR,4|1133" } }
        */
        /*
        scraper format
        date:"2020-11-25 21:28:09"
        message:"Zona Bypass"
        zone:"1"*/
        _parseListableData('logs', current, container, function (lineValue) {
            var line = {};
            line.date = this.cleanData(lineValue.Time.value);
            line.zone = this.cleanData(lineValue.Area.value);
            var event = this.cleanData(lineValue.Event.value);
            line.message = constants.cid[event] || event;
            return line;
        });

        return container;
    }


    /*
     * Not sure about what this means. They seem to be some CID decoded string
     */
    this.GetEvents = function (data) {
        console.log("Formatting GetEvents response");
        var response = {
            events: [],
            raw: data
        };
        for (const key in data) {
            const element = data[key];
            if (element.value) {
                const value = this.cleanData(element.value);
                _listBasedFormatter(key, value, response, 'events', function (lineValue) {
                    return constants.cid[lineValue];
                });
            }
        }
        return response;
    }

    return this;
}