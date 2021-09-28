
const http = require('follow-redirects').http;
const querystring = require('querystring');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const cheerio = require('cheerio');
const alarmStatusDecoder = require('./src/status-decoder');

/**
   * Known web pages type
   */
const defaultPages = ['/RemoteCtr.htm', '/Zone.htm', '/SystemLog.htm'];
//defcon ['/status.html', '/Zone.html', '/SystemLog.html']

function iAlarmScraper(host, port, username, password, zoneToQuery, pages) {

    const self = this;

    try {

        if (pages) {
            console.log("Using custom pages: " + JSON.stringify(pages));
        }

        const RemoteCtrHTML = (pages && pages[0]) || defaultPages[0];
        const ZoneHTML = (pages && pages[1]) || defaultPages[1];
        const SystemLogHTML = (pages && pages[2]) || defaultPages[2];

        const getOptions = function (_method, _path, _postData) {
            // request option
            let options = {
                host: host,
                port: port,
                method: _method,
                path: _path,
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
                }
            };
            if (_method === 'POST') {
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            if (_postData) {
                options.headers['Content-Length'] = _postData.length;
            }
            return options;
        };

        const alarmStatus = alarmStatusDecoder();


        if (!zoneToQuery || !Array.isArray(zoneToQuery)) {
            var zoneCount = zoneToQuery || 40;
            //ialarm have 40 zones on ui, providing a custom number will speed up the getZones function
            zoneToQuery = [];
            for (let index = 0; index < zoneCount; index++) {
                zoneToQuery[index] = index + 1; //index 0 = zone 1
            }
        }

        //zone cache
        var zonesDefinitions;

        const decodeZoneMsg = function (ZoneMsg, i, lastChecked) {

            let zoneStatus = ZoneMsg[i];
            let zoneNumber = i + 1;

            var zone = { id: zoneNumber, status: zoneStatus, lastChecked: lastChecked, message: 'unknown' };

            zone.ok = false;
            zone.alarm = false;
            zone.bypass = false;
            zone.lowbat = false;
            zone.fault = false;
            zone.open = false;

            if (zoneStatus == '0') {
                zone.message = 'OK';
                zone.ok = true;
            }
            if (zoneStatus & 3) {
                zone.message = 'zone alarm';
                zone.alarm = true;
            }
            if (zoneStatus & 8) {
                zone.message = 'zone bypass';
                zone.bypass = true;
            }
            else if (zoneStatus & 16) {
                zone.message = 'zone fault';
                zone.open = true;
                //just a note (and i'm not sure): every sensor reports zone fault when contact i open (windows, etc,). Water sensors do the opposite, open when no water is detected so it may sound like a false positive.
            }
            if ((zoneStatus & 32) && ((zoneStatus & 8) == 0)) {
                zone.message = 'wireless detector low battery';
                zone.lowbat = true;
            }
            if ((zoneStatus & 64) && ((zoneStatus & 8) == 0)) {
                zone.message = 'wireless detector loss';
                zone.fault = true;
            }

            //console.log("Checking msg for zone " + zoneNumber + " : "+zoneStatus+"="+zoneMessage);
            return zone;
        }

        const get = function (_path, _acceptedStatusCode, _callback) {

            //preparing get
            const req = http.request(getOptions('GET', _path), function (res) {
                var result = '';

                if (res.statusCode === 404) {
                    self.emit('error', _path + ' not found, your alarm may not be compatible. Http Status code:' + res.statusCode);
                    return;
                }

                if (res.statusCode !== _acceptedStatusCode) {
                    self.emit('error', _path + ' returned an Http Status code' + res.statusCode);
                    return;
                }

                res.on('data', function (chunk) {
                    result += chunk;
                });
                res.on('end', function () {
                    self.emit('response', result);
                    _callback(result);
                });
                res.on('error', function (err) {
                    console.log(err);
                    self.emit('error', err);
                });
            });

            //request error
            req.on('error', function (err) {
                console.log(err);
                self.emit('error', err);
            });

            //sending request
            req.end();
        };

        const sendCommand = function (state) {

            const value = alarmStatus.fromStatusToScraperValue(state);

            //form
            const postData = querystring.stringify({
                Ctrl: value,
                BypassNum: '00',
                BypassOpt: '0'
            });

            postRemoteCtr(postData);
        };

        const postRemoteCtr = function (postData) {

            //preparing http post
            const req = http.request(getOptions('POST', RemoteCtrHTML, postData), function (res) {
                if (res.statusCode !== 302 && res.statusCode !== 200) {
                    self.emit('error', RemoteCtrHTML + ' returned an http status code ' + res.statusCode);
                    return;
                }

                var result = '';
                res.on('data', function (chunk) {
                    result += chunk;
                });
                res.on('end', function () {
                    self.emit('response', result);
                    self.getStatus('command');
                });
                res.on('error', function (err) {
                    self.emit('error', err);
                });
            });

            //request error
            req.on('error', function (err) {
                self.emit('error', err);
            });

            //sending request with form data
            req.write(postData);
            req.end();
        };

        self.armAway = function () {
            sendCommand('ARMED_AWAY');
        };
        self.armHome = function () {
            sendCommand('ARMED_HOME');
        };
        self.armStay = function () {
            sendCommand('ARMED_HOME');
        };
        self.disarm = function () {
            sendCommand('DISARMED');
        };
        self.cancel = function () {
            sendCommand('CANCEL');
        };
        self.bypassZone = function (number, bypassed) {
            //TODO bypass zone
            /*
              else if(part == "BypassSelect")
              {
                  document.getElementById("Ctrl").value = "0";
                  s = document.getElementById("ZoneSelect");
                  document.getElementById("BypassNum").value =  s.value;
              }*/

            var BypassNum = ('0' + number).slice(-2);
            var BypassOpt = bypassed ? '1' : '2';

            //form
            const postData = querystring.stringify({
                Ctrl: '0', //not selected
                BypassNum: BypassNum, //00 not selected, 01 zone 1, etc
                BypassOpt: BypassOpt //0 not selected, 1 enabled (bypassed), 2 disabled (active)
            });

            postRemoteCtr(postData);
        };

        self.getEvents = function () {

            get(SystemLogHTML, 200, function (result) {

                const $ = cheerio.load(result);
                var events = [];
                $('tr').each(function (i, elem) {
                    var ev = $(this).html();

                    var child$ = cheerio.load(this);
                    let td = child$('td').map(function () {
                        return child$(this).text().trim();
                    }).get();

                    if (td[0] && td[1] && td[2]) {
                        var event = { date: td[0], zone: td[1], message: td[2] };
                        events.push(event);
                    }
                });
                self.emit('events', events);
            });
        };

        self.getStatus = function (eventName) {

            if (!eventName) {
                eventName = 'status';
            }

            get(RemoteCtrHTML, 200, function (result) {

                const $ = cheerio.load(result);

                var tag = $('option[selected=selected]');
                var value = tag.attr('value');

                var data = {};
                data.zones = [];
                //alarm status
                data.status = alarmStatus.fromScraperValueToStatus(value);

                //zones and messages
                var scriptLines = $('script').html().split('\n');

                for (var l = 0; l < scriptLines.length; l++) {
                    var line = scriptLines[l];
                    //var ZoneMsg = new Array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
                    if (line.indexOf('var ZoneMsg') > -1) {

                        var start = line.indexOf('(') + 1;
                        var end = line.indexOf(')');
                        var ZoneMsg = line.substring(start, end);
                        //console.log(ZoneMsg);
                        ZoneMsg = ZoneMsg.split(',');

                        var lastChecked = new Date();

                        for (var i = 0; i < ZoneMsg.length; i++) {

                            //filter zones (index 0 = zone 1)
                            if (!zoneToQuery.includes(i + 1)) {
                                continue;
                            }

                            var zoneData = decodeZoneMsg(ZoneMsg, i, lastChecked);
                            if (zoneData) {
                                if (zoneData.alarm) {
                                    data.status = 'TRIGGERED';
                                }
                                //1 based
                                data.zones.push(zoneData);
                            }
                        }
                        break;
                    }
                }

                self.emit(eventName, data);
            });
        };


        //not very reliable, on concurrent post it will fail on retrieving the posted zone
        self.getZoneInfo = function (zoneNumber) {
            //form
            const postData = querystring.stringify({
                zoneNo: zoneNumber.toString(),
                ZnGetPar: 'GetPar'
            });

            //preparing http post
            var options = getOptions('POST', ZoneHTML, postData);

            var zones = [];

            const req = http.request(options, function (res) {
                if (res.statusCode !== 302 && res.statusCode !== 200) {
                    self.emit('error', ZoneHTML + ' returned an http status code ' + res.statusCode);
                    return;
                }

                var result = '';
                res.on('data', function (chunk) {
                    result += chunk;
                });
                res.on('end', function () {

                    //parse data
                    //ZoneType 'option[selected=selected]'
                    //ZoneName input value

                    var id;
                    var type;
                    var name;
                    try {
                        //console.log(JSON.stringify(result));
                        var $ = cheerio.load(result);

                        try {
                            let zoneNo = $('select[name=zoneNo]').html();
                            //console.log(zoneNo);
                            let child$ = cheerio.load(zoneNo);
                            id = child$('option[selected=selected]').text();
                        } catch (e) {
                            id = undefined;
                        }

                        try {
                            name = $('input[name=ZoneName]').attr('value');
                        } catch (e) {
                            name = undefined;
                        }

                        try {
                            let zoneType = $('select[name=ZoneType]').html();
                            let child$ = cheerio.load(zoneType);
                            type = child$('option[selected=selected]').text();
                        } catch (e) {
                            type = undefined;
                        }

                    } catch (e) {
                        console.log('Errore getZoneInfo ' + e.message);
                    }

                    var zoneInfo = {};
                    zoneInfo.id = id;
                    zoneInfo.name = name;
                    zoneInfo.type = type;

                    zones[zoneInfo.id] = zoneInfo;

                    if (id && zoneNumber == id) {
                        self.emit('zoneInfo', zoneInfo);
                    } else {
                        var err = 'bad response from server: requested ' + zoneNumber + ' got ' + id + '(' + name + ')';
                        self.emit('zoneInfoError', { id: zoneNumber, error: err });
                    }
                });
                res.on('error', function (err) {
                    self.emit('error', err);
                });
            });

            //request error
            req.on('error', function (err) {
                self.emit('error', err);
            });

            //sending request with form data
            req.write(postData);
            req.end();
        };

        self.getAllZones = function (forceReload) {

            function emitZones() {
                //console.log("zoneInfo completed.");
                self.emit('allZones', zonesDefinitions);
            }

            if (forceReload) {
                zonesDefinitions = undefined;
            }

            if (zonesDefinitions) {
                emitZones();
            } else {
                //populating zones

                var checkZone = function (zoneNumber) {
                    self.getZoneInfo(zoneNumber);
                };

                zonesDefinitions = {};
                var retry = 0;
                var errCount = 0;
                self.on('zoneInfo', function (zoneInfo) {
                    //console.log("zoneInfo: "+JSON.stringify(zoneInfo));
                    var zoneNumber = parseInt(zoneInfo.id);
                    zonesDefinitions[zoneNumber] = zoneInfo;

                    //if last
                    if (zoneNumber === zoneToQuery[zoneToQuery.length - 1]) {
                        emitZones();
                        return;
                    }

                    //got name? try again
                    if (!zoneInfo.name && retry === 0) {
                        //max 2 retry
                        retry++;
                        checkZone(zoneNumber);
                    } else {
                        retry = 0;
                        //next
                        var index = zoneToQuery.indexOf(parseInt(zoneNumber));
                        index++;
                        checkZone(zoneToQuery[index]);
                    }
                });

                self.on('zoneInfoError', function (zoneInfoError) {
                    errCount++;
                    if (errCount > 10) {
                        return;
                    }
                    //ialarm html server may fail on concurrent requests
                    console.log('retring: ' + zoneInfoError.id + ' - ' + zoneInfoError.error);
                    checkZone(zoneInfoError.id);
                });


                checkZone(zoneToQuery[0]);

            }
        };


        //only zone with relevant event
        self.filterStatusZones = function (zones) {
            if (!zones) {
                return [];
            }
            return zones.filter(function (zone) {
                return zone.status != 0;
            });
        };


    } catch (e) {
        self.emit('error', e);
    }

}
util.inherits(iAlarmScraper, EventEmitter);

module.exports = iAlarmScraper;
