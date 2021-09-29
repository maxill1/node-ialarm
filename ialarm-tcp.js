
var convert = require('xml-js');
var net = require('net');
var MeianMessage = require('./src/meian-message');
var MeianDataTypes = require('./src/meian-datatypes');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const alarmStatus = require('./src/status-decoder')();
const tcpResponseFormatters = require('./src/tcp-response-formatters')();
const constants = require('./src/constants');

var zoneCache = [];

function MeianClient(host, port, uid, pwd) {

    //default
    port = port || 18034;

    var self = this;
    //sequence for TCP requests
    self.seq = 0;
    //client status
    self.status = 'disconnected';
    //data types
    const types = MeianDataTypes();

    //list container
    var lists = {};

    this.connect = function () {
        self.status = 'connecting';

        self.client = new net.Socket();
        self.client.setTimeout(30000);

        self.client.connect(port, host, function () {
            console.log('Connected to ' + host + ':' + port);
            self.login(uid, pwd);
        });

        self.client.on('data', function (data, arg) {
            self._receive(data);
        });

        self.client.on('close', function () {
            console.log('Connection closed');
            self.status = 'disconnected';
            self.emit('disconnected', { host, port });
        });
    };

    /**
     * Disconnect from TCP Alarm
     */
    self.disconnect = function () {
        console.log('Closing connection...');
        if (self.client) {
            self.status = 'disconnecting';
            self.client.destroy();
        }
    };

    /**
     * Convert to XML the data, encrypt the message and send the request to TCP alarm
     */
    this._send = function (root, cmd) {

        var paths = root.split('/');
        var data = {};
        var lastIteratedObj = data;
        for (let i = 1; i < paths.length; i++) {
            const key = paths[i];
            lastIteratedObj[key] = {};
            if (i === paths.length - 1) {
                lastIteratedObj[key] = cmd;
            }
            lastIteratedObj = lastIteratedObj[key];
        }
        const xml = convert.js2xml(data, { compact: true, fullTagEmptyElement: true, spaces: 0 });
        console.log('Requesting XML ' + xml);

        //incrementing sequence
        self.seq += 1;
        const msg = MeianMessage().createMessage(xml, self.seq, true);
        console.log('Requesting RAW ' + msg);

        //send data to socket
        self.client.write(msg);

    };

    /**
     * Parse the TCP alarm response buffer
     */
    this._receive = function (buffer) {
        var raw = String.fromCharCode.apply(null, buffer);
        console.log('Received RAW ' + raw);
        var xml = MeianMessage().extractMessage(raw);
        console.log('Received XML ' + xml);
        //cleanup <Err>ERR|00</Err> at root
        var Err = undefined;
        if (xml.indexOf('<Err>ERR') === 0) {
            const error = xml.substring(0, xml.indexOf('</Err>') + 6);
            xml = xml.replace(error, '');
            Err = convert.xml2js(error, { compact: true, textKey: 'value' });
        }
        const data = convert.xml2js(xml, { compact: true, textKey: 'value' });
        //apply <Err>ERR|00</Err> at root
        if (Err) {
            data.Err = Err.Err.value;
        }
        console.log('Received data: ', data);
        //TODO check errors
        if (data.Err && data.Err !== 'ERR|00') {
            self.emit('error', data.Err);
        } else {
            //custom event based on query
            var event = constants.events[self._getCmdName(data)] //custom command
                || self._getCmdName(data)  //host command (GetZone, GetByWay)
                || constants.events.default // response;
            if (self.status === 'autenticating') {
                event = 'connected';
                self.status = event;
            }

            //raw response or formatted response
            var response = data;
            //data formatters
            if (data.Root.Host) {
                var cmdName = Object.keys(data.Root.Host)[0];
                var formatter = tcpResponseFormatters[cmdName];
                if (formatter) {
                    response = formatter(data.Root.Host[cmdName], lists[cmdName]);
                }
            }

            var done = false;
            //list handler (multiple messages in chain)
            if (cmdName && lists[cmdName]) {
                //current list
                lists[cmdName] = response;

                //lets determine the offset size
                const latestRaw = response.raw[response.raw.length - 1];
                const total = tcpResponseFormatters.cleanData(latestRaw.Total.value);
                const offset = tcpResponseFormatters.cleanData(latestRaw.Offset.value);
                const ln = tcpResponseFormatters.cleanData(latestRaw.Ln.value);
                var newOffset = offset + ln;
                if (total > newOffset) {
                    //call the same command with different offset
                    let functionName = cmdName.substring(0, 1).toLowerCase() + cmdName.substring(1);
                    if (self[functionName]) {
                        self[functionName](newOffset);
                    }
                } else {
                    //list is complete
                    done = true;
                }
            } else {
                //not a list: we can emit the response
                done = true;
            }

            if (done) {
                self.emit(event, response);
            }
        }
    };

    /**
     * Prepare an empty storage for the list/raw that will be used by all the events with different offsets
     */
    this._initList = function (cmdName, offset) {
        if (!offset || offset === 0 || !lists[cmdName]) {
            lists[cmdName] = {};
        }
    }

    /**
     * Command name from response 
     * @param {*} response 
     * @returns 
     */
    this._getCmdName = function (response) {
        //es. Root/Host/GetZone > GetZone
        if (response && response.Root && response.Root.Host) {
            const cmdName = Object.keys(response.Root.Host)[0];
            return cmdName;
        }
        if (response && response.Pair && response.Pair.Client) {
            return 'login';
        }
        return undefined;
    }

    /**
     * Login
     */
    this.login = function (uid, pwd) {

        self.status = 'autenticating';

        var cmd = {};
        cmd.Id = types.STR(uid);
        cmd.Pwd = types.PWD(pwd);
        cmd.Type = 'TYP,ANDROID|0';
        cmd.Token = types.STR(function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }());
        cmd.Action = 'TYP,IN|0';
        cmd.Err = null;
        //request
        self._send('/Root/Pair/Client', cmd);
    };

    /**
     * Get current alarm status
     */
    this.getAlarmStatus = function () {
        var cmd = {};
        cmd['DevStatus'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetAlarmStatus', cmd);
    };

    /**
     * Set current alarm status
     */
    this.setAlarmStatus = function (status) {
        //0,1,2
        var cmd = {};
        cmd['DevStatus'] = types.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR']);
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/SetAlarmStatus', cmd);
    };

    /**
     * get sensor status (alarm/open/closed, problem, lowbat, bypass, etc)
     */
    this.getByWay = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //request
        self._send('/Root/Host/GetByWay', cmd);
    };

    /**
     * Set bypass for sensor
     * @param {*} pos 
     * @param {*} en 
     */
    this.setByWay = function (pos, en) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['En'] = types.BOL(en);
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/SetByWay', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getDefense = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetDefense', cmd);
    };

    this.getEmail = function () {
        var cmd = {};
        cmd['Ip'] = null;
        cmd['Port'] = null;
        cmd['User'] = null;
        cmd['Pwd'] = null;
        cmd['EmailSend'] = null;
        cmd['EmailRecv'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetEmail', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getEvents = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetEvents', cmd);
    };

    this.getGprs = function () {
        var cmd = {};
        cmd['Apn'] = null;
        cmd['User'] = null;
        cmd['Pwd'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetGprs', cmd);
    };

    /**
     * Log
     * @param {*} offset 
     */
    this.getLog = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetLog", offset);

        //request
        self._send('/Root/Host/GetLog', cmd);
    };

    this.getNet = function () {
        var cmd = {};
        cmd['Mac'] = null;
        cmd['Name'] = null;
        cmd['Ip'] = null;
        cmd['Gate'] = null;
        cmd['Subnet'] = null;
        cmd['Dns1'] = null;
        cmd['Dns2'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetNet', cmd);
    };


    /**
     * TODO may be a list
     */
    this.getOverlapZone = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32();
        cmd['Ln'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetOverlapZone', cmd);
    };

    this.getPairServ = function () {
        var cmd = {};
        cmd['Ip'] = null;
        cmd['Port'] = null;
        cmd['Id'] = null;
        cmd['Pwd'] = null;
        cmd['Err'] = null;
        //request
        self._send('/Root/Host/GetPairServ', cmd);
    };

    /**
     * Configurazione telefonica
     * TODO may be a list
     */
    this.getPhone = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['RepeatCnt'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetPhone', cmd, true);
    };

    /**
     * Telecomandi
     * @param {*} offset 
     */
    this.getRemote = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetRemote", offset);

        self._send('/Root/Host/GetRemote', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getRfid = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetRfid', cmd, true);
    };

    /**
     * TODO may be a list
     */
    this.getRfidType = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetRfidType', cmd, true);
    };

    this.getSendby = function (cid) {
        var cmd = {};
        cmd['Cid'] = types.STR(cid);
        cmd['Tel'] = null;
        cmd['Voice'] = null;
        cmd['Sms'] = null;
        cmd['Email'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetSendby', cmd);
    };

    /**
     * Sensor List with id 
     * TODO decoder
     * @param {*} offset 
     */
    this.getSensor = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetSensor", offset);

        self._send('/Root/Host/GetSensor', cmd);
    };

    this.getServ = function () {
        var cmd = {};
        cmd['En'] = null;
        cmd['Ip'] = null;
        cmd['Port'] = null;
        cmd['Name'] = null;
        cmd['Pwd'] = null;
        cmd['Cnt'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetServ', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getSwitch = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetSwitch", offset);

        self._send('/Root/Host/GetSwitch', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getSwitchInfo = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetSwitchInfo", offset);

        self._send('/Root/Host/GetSwitchInfo', cmd);
    };

    /**
     * system configuration (InDelay, OutDelay, AlarmTime, WlLoss, AcLoss, ComLoss, ArmVoice, ArmReport, ForceArm, DoorCheck, BreakCheck, AlarmLimit, etc)
     */
    this.getSys = function () {
        var cmd = {};
        cmd['InDelay'] = null;
        cmd['OutDelay'] = null;
        cmd['AlarmTime'] = null;
        cmd['WlLoss'] = null;
        cmd['AcLoss'] = null;
        cmd['ComLoss'] = null;
        cmd['ArmVoice'] = null;
        cmd['ArmReport'] = null;
        cmd['ForceArm'] = null;
        cmd['DoorCheck'] = null;
        cmd['BreakCheck'] = null;
        cmd['AlarmLimit'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetSys', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getTel = function () {
        var cmd = {};
        cmd['En'] = null;
        cmd['Code'] = null;
        cmd['Cnt'] = null;
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetTel', cmd, true);
    };

    this.getTime = function () {
        var cmd = {};
        cmd['En'] = null;
        cmd['Name'] = null;
        cmd['Type'] = null;
        cmd['Time'] = null;
        cmd['Dst'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetTime', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getVoiceType = function () {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(0);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetVoiceType', cmd, true);
    };

    this.getZone = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetZone", offset);

        self._send('/Root/Host/GetZone', cmd);
    };

    /**
     * TODO may be a list
     */
    this.getZoneType = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetZoneType", offset);

        self._send('/Root/Host/GetZoneType', cmd);
    };

    this.wlsStudy = function () {
        var cmd = {};
        cmd['Err'] = null;
        self._send('/Root/Host/WlsStudy', cmd);
    };

    this.configWlWaring = function () {
        var cmd = {};
        cmd['Err'] = null;
        self._send('/Root/Host/ConfigWlWaring', cmd);
    };

    this.fskStudy = function (en) {
        var cmd = {};
        cmd['Study'] = types.BOL(en);
        cmd['Err'] = null;
        self._send('/Root/Host/FskStudy', cmd);
    };

    this.getWlsStatus = function (num) {
        var cmd = {};
        cmd['Num'] = types.S32(num);
        cmd['Bat'] = null;
        cmd['Tamp'] = null;
        cmd['Status'] = null;
        cmd['Err'] = null;
        self._send('/Root/Host/GetWlsStatus', cmd);
    };

    this.delWlsDev = function (num) {
        var cmd = {};
        cmd['Num'] = types.S32(num);
        cmd['Err'] = null;
        self._send('/Root/Host/DelWlsDev', cmd);
    };

    this.wlsSave = function (typ, num, code) {
        var cmd = {};
        cmd['Type'] = 'TYP,NO|%d' % typ;
        cmd['Num'] = types.S32(num, 1);
        cmd['Code'] = types.STR(code);
        cmd['Err'] = null;
        self._send('/Root/Host/WlsSave', cmd);
    };

    /**
     * ????
     * @param {*} offset 
     */
    this.getWlsList = function (offset) {
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //list handler
        self._initList("GetWlsList", offset);

        self._send('/Root/Host/GetWlsList', cmd);
    };

    this.swScan = function () {
        var cmd = {};
        cmd['Err'] = null;
        self._send('/Root/Host/SwScan', cmd);
    };

    this.reset = function (ret) {
        var cmd = {};
        cmd['Ret'] = types.BOL(ret);
        cmd['Err'] = null;
        self._send('/Root/Host/Reset', cmd);
    };

    this.opSwitch = function (self, pos, en) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['En'] = types.BOL(en);
        cmd['Err'] = null;
        self._send('/Root/Host/OpSwitch', cmd);
    };

    this.setAlarmStatus = function (status) {
        var cmd = {};
        cmd['DevStatus'] = types.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR']);
        cmd['Err'] = null;
        self._send('/Root/Host/SetAlarmStatus', cmd);
    };

    this.setByWay = function (pos, en) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['En'] = types.BOL(en);
        cmd['Err'] = null;
        self._send('/Root/Host/SetByWay', cmd);
    };

    this.setDefense = function (pos, hmdef = '00:00', hmundef = '00:00') {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Def'] = types.STR(hmdef);
        cmd['Undef'] = types.STR(hmundef);
        cmd['Err'] = null;
        self._send('/Root/Host/SetDefense', cmd);
    };

    this.setEmail = function (ip, port, user, pwd, emailsend, emailrecv) {
        var cmd = {};
        cmd['Ip'] = types.STR(ip);
        cmd['Port'] = types.S32(port);
        cmd['User'] = types.STR(user);
        cmd['Pwd'] = types.PWD(pwd);
        cmd['EmailSend'] = types.STR(emailsend);
        cmd['EmailRecv'] = types.STR(emailrecv);
        cmd['Err'] = null;
        self._send('/Root/Host/SetEmail', cmd);
    };

    this.setGprs = function (apn, user, pwd) {
        var cmd = {};
        cmd['Apn'] = types.STR(apn);
        cmd['User'] = types.STR(user);
        cmd['Pwd'] = types.PWD(pwd);
        cmd['Err'] = null;
        self._send('/Root/Host/SetGprs', cmd);
    };

    this.setNet = function (mac, name, ip, gate, subnet, dns1, dns2) {
        var cmd = {};
        cmd['Mac'] = types.MAC(mac);
        cmd['Name'] = types.STR(name);
        cmd['Ip'] = types.IPA(ip);
        cmd['Gate'] = types.IPA(gate);
        cmd['Subnet'] = types.IPA(subnet);
        cmd['Dns1'] = types.IPA(dns1);
        cmd['Dns2'] = types.IPA(dns2);
        cmd['Err'] = null;
        self._send('/Root/Host/SetNet', cmd);
    };

    this.setOverlapZone = function (pos, zone1, zone2, time) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Zone1'] = types.S32(zone1, 1);
        cmd['Zone1'] = types.S32(zone2, 1);
        cmd['Time'] = types.S32(time, 1);
        cmd['Err'] = null;
        self._send('/Root/Host/SetOverlapZone', cmd);
    };

    this.setPairServ = function (ip, port, uid, pwd) {
        var cmd = {};
        cmd['Ip'] = types.IPA(ip);
        cmd['Port'] = types.S32(port, 1);
        cmd['Id'] = types.STR(uid);
        cmd['Pwd'] = types.PWD(pwd);
        cmd['Err'] = null;
        self._send('/Root/Host/SetPairServ', cmd);
    };

    this.setPhone = function (pos, num) {
        var cmd = {};
        cmd['Type'] = types.TYP(1, ['F', 'L']);
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Num'] = types.STR(num);
        cmd['Err'] = null;
        self._send('/Root/Host/SetPhone', cmd);
    };

    this.setRfid = function (pos, code, typ, msg) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Type'] = types.S32(typ, ['NO', 'DS', 'HS', 'DM', 'HM', 'DC']);
        cmd['Code'] = types.STR(code);
        cmd['Msg'] = types.STR(msg);
        cmd['Err'] = null;
        self._send('/Root/Host/SetRfid', cmd);
    };

    this.setRemote = function (pos, code) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Code'] = types.STR(code);
        cmd['Err'] = null;
        self._send('/Root/Host/SetRemote', cmd);
    };

    this.setSendby = function (cid, tel, voice, sms, email) {
        var cmd = {};
        cmd['Cid'] = types.STR(cid);
        cmd['Tel'] = types.BOL(tel);
        cmd['Voice'] = types.BOL(voice);
        cmd['Sms'] = types.BOL(sms);
        cmd['Email'] = types.BOL(email);
        cmd['Err'] = null;
        self._send('/Root/Host/SetSendby', cmd);
    };

    this.setSensor = function (pos, code) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Code'] = types.STR(code);
        cmd['Err'] = null;
        self._send('/Root/Host/SetSensor', cmd);
    };

    this.setServ = function (en, ip, port, name, pwd, cnt) {
        var cmd = {};
        cmd['En'] = types.BOL(en);
        cmd['Ip'] = types.STR(ip);
        cmd['Port'] = types.S32(port, 1);
        cmd['Name'] = types.STR(name);
        cmd['Pwd'] = types.PWD(pwd);
        cmd['Cnt'] = types.S32(cnt, 1);
        cmd['Err'] = null;
        self._send('/Root/Host/SetServ', cmd);
    };

    this.setSwitch = function (pos, code) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Code'] = types.STR(code);
        cmd['Err'] = null;
        self._send('/Root/Host/SetSwitch', cmd);
    };

    this.setSwitchInfo = function (pos, name, hmopen = '00:00', hmclose = '00:00') {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Name'] = types.STR(name.substring(0, 7).encode('hex'));
        cmd['Open'] = types.STR(hmopen);
        cmd['Close'] = types.STR(hmclose);
        cmd['Err'] = null;
        self._send('/Root/Host/SetSwitchInfo', cmd);
    };

    this.setSys = function (indelay, outdelay, alarmtime, wlloss, acloss, comloss, armvoice, armreport, forcearm, doorcheck, breakcheck, alarmlimit) {
        var cmd = {};
        cmd['InDelay'] = types.S32(indelay, 1);
        cmd['OutDelay'] = types.S32(outdelay, 1);
        cmd['AlarmTime'] = types.S32(alarmtime, 1);
        cmd['WlLoss'] = types.S32(wlloss, 1);
        cmd['AcLoss'] = types.S32(acloss, 1);
        cmd['ComLoss'] = types.S32(comloss, 1);
        cmd['ArmVoice'] = types.BOL(armvoice);
        cmd['ArmReport'] = types.BOL(armreport);
        cmd['ForceArm'] = types.BOL(forcearm);
        cmd['DoorCheck'] = types.BOL(doorcheck);
        cmd['BreakCheck'] = types.BOL(breakcheck);
        cmd['AlarmLimit'] = types.BOL(alarmlimit);
        cmd['Err'] = null;
        self._send('/Root/Host/SetSys', cmd);
    };

    this.setTel = function (en, code, cnt) {
        var cmd = {};
        cmd['Typ'] = types.TYP(0, ['F', 'L']);
        cmd['En'] = types.BOL(en);
        cmd['Code'] = types.NUM(code);
        cmd['Cnt'] = types.S32(cnt, 1);
        cmd['Err'] = null;
        self._send('/Root/Host/SetTel', cmd);
    };

    this.setTime = function (en, name, typ, time, dst) {
        var cmd = {};
        cmd['En'] = types.BOL(en);
        cmd['Name'] = types.STR(name);
        cmd['Type'] = 'TYP,0|%d' % typ;
        cmd['Time'] = types.DTA(time);
        cmd['Dst'] = types.BOL(dst);
        cmd['Err'] = null;
        self._send('/Root/Host/SetTime', cmd);
    };

    this.setZone = function (pos, typ, voice, name, bell) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['Type'] = types.TYP(typ, ['NO', 'DE', 'SI', 'IN', 'FO', 'HO24', 'FI', 'KE', 'GAS', 'WT']);
        cmd['Voice'] = types.TYP(voice, ['CX', 'MC', 'NO']);
        cmd['Name'] = types.STR(name);
        cmd['Bell'] = types.BOL(bell);
        cmd['Err'] = null;
        self._send('/Root/Host/SetZone', cmd);
    };

    //scraper impl compatibility methods

    /**
     * Full status: armed/disarmed/triggered and all sensors data with names
     * @param {*} forceZoneInfo 
     */
    self.getStatus = function (forceZoneInfo) {

        var alarmStatus = {
            status: '',
            zones: []
        };

        if (forceZoneInfo || !zoneCache || zoneCache.length === 0) {
            console.info("Missing zone info (name, type, voice, etc), fetching with GetZone");
            //get zone definitions
            self.getZone()
            self.on('GetZone', function (data) {
                zoneCache = data && data.zones || [];
                //armed/disarmed
                self.getAlarmStatus()
            })
        } else {
            //armed/disarmed
            self.getAlarmStatus()
        }

        //get specific zone
        self.on('GetAlarmStatus', function (status) {
            alarmStatus.status = status;
            self.getByWay();
        })

        self.on('GetByWay', function (data) {
            alarmStatus.zones = []
            if (data && data.zones) {
                for (let index = 0; index < data.zones.length; index++) {
                    const zone = data.zones[index];
                    const info = zoneCache.find(z => z.id === zone.id);
                    //merge
                    alarmStatus.zones[index] = {
                        ...zone,
                        ...info
                    }
                }
                self.emit('status', alarmStatus);
            }
        })
    }

    /**
     * Arm Away
     */
    self.armAway = function () {
        const value = alarmStatus.fromStatusToTcpValue('ARMED_AWAY');
        self.setAlarmStatus(value);
    };

    /**
     * Arm home
     */
    self.armHome = function () {
        const value = alarmStatus.fromStatusToTcpValue('ARMED_HOME');
        self.setAlarmStatus(value);
    };

    /**
     * Arm home alias
     */
    self.armStay = function () {
        const value = alarmStatus.fromStatusToTcpValue('ARMED_HOME');
        self.setAlarmStatus(value);
    };

    /**
     * Disarm
     */
    self.disarm = function () {
        const value = alarmStatus.fromStatusToTcpValue('DISARMED');
        self.setAlarmStatus(value);
    };

    /**
     * Cancel triggered status
     */
    self.cancel = function () {
        const value = alarmStatus.fromStatusToTcpValue('CANCEL');
        self.setAlarmStatus(value);
    };

    /**
     * Bypass/reset bypass zone
     * @param {*} number 
     * @param {*} bypassed 
     */
    self.bypassZone = function (number, bypassed) {
        console.log("bypass " + number + "=" + bypassed)
        self.setByWay(number, bypassed);
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

    /**
     * Get all zones definition
     */
    self.getAllZones = function () {
        self.getZone()
        self.on('GetZone', function (data) {
            zoneCache = data && data.zones || []
            self.emit('allZones', zoneCache);
        })
    };

    /**
     * single zone info
     * @param {*} zoneNumber 
     */
    self.getZoneInfo = function (zoneNumber) {
        self.getZone()
        //get specific zone
        self.on('GetZone', function (data) {
            const zones = data && data.zones || [];
            if (zones.length > 0) {
                const info = zones.find(z => z.id === zoneNumber);
                if (info) {
                    self.emit('zoneInfo', info);
                } else {
                    self.emit('zoneInfoError', { id: zoneNumber, error: 'not found' });
                }
            }
        })
    }

    return self;
}

util.inherits(MeianClient, EventEmitter);

module.exports = MeianClient;