
const MeianSocket = require('./src/meian-socket');
const alarmStatus = require('./src/status-decoder')();

function MeianClient(host, port, uid, pwd) {

    var self = this;

    const socket = MeianSocket(host, port, uid, pwd);

    /**
     * Full status: armed/disarmed/triggered and all sensors data with names
     * @param {*} forceZoneInfo 
     */
    self.getStatus = function () {
        return new Promise((resolve, reject) => {
            const commands = ['GetAlarmStatus', 'GetByWay', 'GetZone'];
            return socket.executeCommand(commands).then(function ({ data }) {

                const { GetAlarmStatus, GetByWay, GetZone } = data

                if (!GetAlarmStatus) {
                    reject("GetAlarmStatus returned empty data");
                }
                if (!GetByWay) {
                    reject("GetByWay returned empty data");
                }
                if (!GetZone) {
                    reject("GetZone returned empty data");
                }

                var response = {
                    status: GetAlarmStatus,
                    zones: GetByWay.zones
                };

                const zoneConfig = GetZone && GetZone.zones;
                if (response.zones && zoneConfig) {
                    for (let index = 0; index < response.zones.length; index++) {
                        const zone = response.zones[index];
                        const info = zoneConfig.find(z => z.id === zone.id);
                        //merge
                        response.zones[index] = {
                            ...zone,
                            ...info
                        }
                    }
                }

                resolve(response);
            }, function (err) {
                reject(err);
            })
        });
    }

    /**
     * Arm Away
     */
    self.armAway = function () {
        return self.armDisarm('ARMED_AWAY');
    }

    /**
     * Arm home
     */
    self.armHome = function () {
        return self.armDisarm('ARMED_HOME');
    };


    /**
     * Arm home alias
     */
    self.armStay = function () {
        return self.armHome();
    };


    /**
     * Disarm
     */
    self.disarm = function () {
        return self.armDisarm('DISARMED');
    };

    /**
     * Cancel triggered status
     */
    self.cancel = function () {
        return self.armDisarm('CANCEL');
    };

    /**
     * promise with command execution and full status response
     * @param {*} commands 
     * @param {*} args 
     * @returns 
     */
    function MeianPromiseWithStatusResponse(commands, args) {
        return new Promise((resolve, reject) => {
            console.log("requesting " + commands + " with args " + args)
            socket.executeCommand(commands, args).then(function (commandResponse) {
                console.log(commandResponse);
                self.getStatus().then(function (response) {
                    if (response) {
                        resolve(response);
                    } else {
                        reject("getStatus returned no data");
                    }
                }, function (err) {
                    reject(err);
                })
            }, function (err) {
                reject(err);
            });
        });
    }

    /**
     * generic arm disarm function
     * @param {*} requestedArmedStatus 
     * @returns 
     */
    self.armDisarm = function (requestedArmedStatus) {
        const value = alarmStatus.fromStatusToTcpValue(requestedArmedStatus);
        return MeianPromiseWithStatusResponse(['SetAlarmStatus'], [value]);
    }

    /**
     * Bypass/reset bypass zone
     * @param {*} number 
     * @param {*} bypassed 
     */
    self.bypassZone = function (zoneNumber, bypassed) {
        console.log("bypass zone " + zoneNumber + "=" + bypassed)
        //in tcp call zone is Zero-based numbering
        return MeianPromiseWithStatusResponse(['SetByWay'], [[zoneNumber - 1, bypassed]]);
    }

    /**
     * Get all zones definition
     */
    self.getZoneInfo = function (zoneNumber) {
        return new Promise((resolve, reject) => {
            socket.executeCommand(['GetZone']).then(function (response) {
                if (response && response.data && response.data.GetZone) {
                    var zones = response.data.GetZone.zones;
                    if (zoneNumber) {
                        const info = zones.find(z => z.id === zoneNumber);
                        if (info) {
                            return info;
                        }
                    }
                    resolve(zones);
                } else {
                    reject("GetZone returned no data");
                }
            }, function (err) {
                reject(err);
            });
        });
    }

    /**
     * Logged events (armed, disarmed, etc)
     * @returns 
     */
    self.getEvents = function () {
        return new Promise((resolve, reject) => {
            socket.executeCommand(['GetLog']).then(function ({ data }) {
                if (data && data.GetLog && data.GetLog.logs) {
                    resolve(data.GetLog.logs);
                } else {
                    reject("GetLog returned no data");
                }
            }, function (err) {
                reject(err);
            });
        });
    };

    /**
     * same as getZoneInfo without any zoneNumber
     * @returns 
     */
    self.getAllZones = function () {
        return self.getZoneInfo();
    }

    /**
     * filter zones with relevant status 
     * @param {*} zones 
     * @returns 
     */
    self.filterStatusZones = function (zones) {
        if (!zones) {
            return [];
        }
        return zones.filter(function (zone) {
            return zone.status > 1;
        });
    };

    return self;
}

module.exports = MeianClient;