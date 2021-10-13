
var convert = require('xml-js');
var MeianDataTypes = require('./meian-datatypes');
const types = MeianDataTypes();

/**
 * Meian Message builder/parse based on this specs:
 * https://github.com/wildstray/meian-client/wiki
 */
function MeianMessage() {
    var self = this;

    /**
       * 128 bytes key as byte array
       */
    const KEY = ((hexString) => {
        var result = [];
        for (var i = 0; i < hexString.length; i += 2) {
            result.push(parseInt(hexString.substr(i, 2), 16));
        }
        return result;
    })('0c384e4e62382d620e384e4e44382d300f382b382b0c5a6234384e304e4c372b10535a0c20432d171142444e58422c421157322a204036172056446262382b5f0c384e4e62382d620e385858082e232c0f382b382b0c5a62343830304e2e362b10545a0c3e432e1711384e625824371c1157324220402c17204c444e624c2e12');

    var toString = function (bytes) {
        var str = '';
        for (var i = 0; i < bytes.length; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str;
    };

    var getBytes = function (str) {
        var bytes = str.split('').map(function s(x) { return x.charCodeAt(0); });
        return bytes;
    };

    /**
     * XOR encrypted/decrypted message with a 128 bytes key
     */
    var decryptEncrypt = function (message) {
        var bytes = getBytes(message);
        // var str = toString(buf)
        // console.log(str)
        for (let i = 0; i < bytes.length; i++) {
            const ki = i & 0x7f;
            bytes[i] = bytes[i] ^ KEY[ki];
        }
        return bytes;
    };

    /**
     * Encrypt and build a message
     */
    self.createMessage = function (xml, sequence, isRequest) {
        if (!sequence) {
            sequence = 1;
        }
        var encryptedMessageBytes = decryptEncrypt(xml);
        var encryptedMessage = toString(encryptedMessageBytes);
        var msgType = '@ieM'; // First 4 bytes is the message type: There are three message types: 1) get/set ('@ieM') 2) push ('@alA') 3) keepalive ('%maI').
        var msgSize = ('000' + encryptedMessageBytes.length).slice(-4); // next four bytes are size of encrypted data
        var msgSeq = ('000' + sequence).slice(-4); // next four bytes are a sequence number
        var msgFiller = '0000'; // next four bytes are always zeroes then there is an encrypted request or response.;
        var msgEnding = !isRequest ? msgSize : '0000'; // Last four bytes are size of encrypted data for request, 0000 or -001 for response
        var msg = `${msgType}${msgSize}${msgSeq}${msgFiller}${encryptedMessage}${msgEnding}`;
        return msg;
    };

    /**
     * Encrypt and build a message
     */
    self.extractMessage = function (data) {
        // remove head (msg type, size and filler) and tail (msg size or -0001)
        var encryptedMessage = data.substring(0, data.length - 4).substring(16);
        var decryptedMessageBytes = decryptEncrypt(encryptedMessage);
        var message = toString(decryptedMessageBytes);
        return message;
    };

    return self;
}

module.exports.MeianMessage = MeianMessage

/**
 * Convert to XML the data, encrypt the message 
 */
function _prepareMessage(root, cmd, sequence) {

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
    //console.log('Requesting XML ' + xml);

    const msg = MeianMessage().createMessage(xml, sequence || 1, true);
    //console.log('Requesting RAW ' + msg);

    return msg;
}

module.exports.MeianMessageFunctions = {
    /**
     * Login
     */
    Client: function (uid, pwd) {

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
        return {
            seq: 0,
            socketStatus: 'autenticating',
            message: _prepareMessage('/Root/Pair/Client', cmd)
        };
    },
    /**
    * Get current alarm status
    */
    GetAlarmStatus: function () {
        var cmd = {};
        cmd['DevStatus'] = null;
        cmd['Err'] = null;
        //request
        return {
            seq: 0,
            message: _prepareMessage('/Root/Host/GetAlarmStatus', cmd)
        };
    },
    /**
    * get sensor status (alarm/open/closed, problem, lowbat, bypass, etc)
    */
    GetByWay: function (offset) {
        offset = offset || 0;

        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset);
        cmd['Ln'] = null;
        cmd['Err'] = null;
        //request
        return {
            seq: 0,
            offset: offset,
            isList: true,
            message: _prepareMessage('/Root/Host/GetByWay', cmd, offset)
        };
    },

    /**
     * All zones status (fault, battery, loss, etc)
     * @param {*} offset 
     */
    GetZone: function (offset) {
        offset = offset || 0;

        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //request
        return {
            seq: 0,
            offset: offset,
            isList: true,
            message: _prepareMessage('/Root/Host/GetZone', cmd, offset)
        };
    },

    /**
     * Log, total is max 512 and it may take some time
     * @param {*} offset 
     */
    GetLog: function (offset) {
        offset = offset || 0;
        var cmd = {};
        cmd['Total'] = null;
        cmd['Offset'] = types.S32(offset || 0);
        cmd['Ln'] = null;
        cmd['Err'] = null;

        //request
        return {
            seq: 0,
            offset: offset,
            isList: true,
            message: _prepareMessage('/Root/Host/GetLog', cmd, offset)
        };
    },

    /**
     * Alarm name, mac address and network configuration
     * @returns 
     */
    GetNet: function () {
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
        return {
            seq: 0,
            message: _prepareMessage('/Root/Host/GetNet', cmd)
        };
    },

    /**
     * Set current alarm status
     */
    SetAlarmStatus: function (status) {
        //0,1,2
        var cmd = {};
        cmd['DevStatus'] = types.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR']);
        cmd['Err'] = null;
        //request
        return {
            seq: 0,
            message: _prepareMessage('/Root/Host/SetAlarmStatus', cmd)
        };
    },

    /**
     * Set bypass for sensor
     * @param {*} pos 
     * @param {*} en 
     */
    SetByWay: function (pos, en) {
        var cmd = {};
        cmd['Pos'] = types.S32(pos, 1);
        cmd['En'] = types.BOL(en);
        cmd['Err'] = null;
        //request
        return {
            seq: 0,
            message: _prepareMessage('/Root/Host/SetByWay', cmd)
        };
    },


    //NOT TESTED


    // /**
    //  * AlarmEvent.htm
    //  * TODO may be a list
    //  */
    // GetEvents: function () {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetEvents', cmd)
    //     };
    // },

    // GetGprs: function () {
    //     var cmd = {};
    //     cmd['Apn'] = null;
    //     cmd['User'] = null;
    //     cmd['Pwd'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetGprs', cmd)
    //     };
    // },


    // /**
    //  * TODO may be a list, should be arm/disarm timer functions
    //  */
    // GetDefense: function () {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetDefense', cmd)
    //     };
    // },

    // GetEmail: function () {
    //     var cmd = {};
    //     cmd['Ip'] = null;
    //     cmd['Port'] = null;
    //     cmd['User'] = null;
    //     cmd['Pwd'] = null;
    //     cmd['EmailSend'] = null;
    //     cmd['EmailRecv'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetEmail', cmd)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetOverlapZone: function () {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32();
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetOverlapZone', cmd)
    //     };
    // },

    // GetPairServ: function () {
    //     var cmd = {};
    //     cmd['Ip'] = null;
    //     cmd['Port'] = null;
    //     cmd['Id'] = null;
    //     cmd['Pwd'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetPairServ', cmd)
    //     };
    // },

    // /**
    //  * Configurazione telefonica
    //  * TODO may be a list
    //  */
    // GetPhone: function () {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(0);
    //     cmd['Ln'] = null;
    //     cmd['RepeatCnt'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetPhone', cmd)
    //     };
    // },

    // /**
    //  * Telecomandi
    //  * @param {*} offset 
    //  */
    // GetRemote: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetRemote', cmd, offset)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetRfid: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetRfid', cmd, offset)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetRfidType: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetRfidType', cmd, offset)
    //     };
    // },

    // GetSendby: function (cid) {
    //     var cmd = {};
    //     cmd['Cid'] = types.STR(cid);
    //     cmd['Tel'] = null;
    //     cmd['Voice'] = null;
    //     cmd['Sms'] = null;
    //     cmd['Email'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetSendby', cmd)
    //     };
    // },

    // /**
    //  * Sensor List with id 
    //  * TODO decoder
    //  * @param {*} offset 
    //  */
    // GetSensor: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetSensor', cmd, offset)
    //     };
    // },

    // GetServ: function () {
    //     var cmd = {};
    //     cmd['En'] = null;
    //     cmd['Ip'] = null;
    //     cmd['Port'] = null;
    //     cmd['Name'] = null;
    //     cmd['Pwd'] = null;
    //     cmd['Cnt'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetServ', cmd)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetSwitch: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetSwitch', cmd, offset)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetSwitchInfo: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetSwitchInfo', cmd, offset)
    //     };
    // },

    // /**
    //  * system configuration (InDelay, OutDelay, AlarmTime, WlLoss, AcLoss, ComLoss, ArmVoice, ArmReport, ForceArm, DoorCheck, BreakCheck, AlarmLimit, etc)
    //  */
    // GetSys: function () {
    //     var cmd = {};
    //     cmd['InDelay'] = null;
    //     cmd['OutDelay'] = null;
    //     cmd['AlarmTime'] = null;
    //     cmd['WlLoss'] = null;
    //     cmd['AcLoss'] = null;
    //     cmd['ComLoss'] = null;
    //     cmd['ArmVoice'] = null;
    //     cmd['ArmReport'] = null;
    //     cmd['ForceArm'] = null;
    //     cmd['DoorCheck'] = null;
    //     cmd['BreakCheck'] = null;
    //     cmd['AlarmLimit'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetSys', cmd)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetTel: function (offset) {
    //     var cmd = {};
    //     cmd['En'] = null;
    //     cmd['Code'] = null;
    //     cmd['Cnt'] = null;
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetTel', cmd, offset)
    //     };
    // },

    // GetTime: function () {
    //     var cmd = {};
    //     cmd['En'] = null;
    //     cmd['Name'] = null;
    //     cmd['Type'] = null;
    //     cmd['Time'] = null;
    //     cmd['Dst'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetTime', cmd)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetVoiceType: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetVoiceType', cmd, offset)
    //     };
    // },

    // /**
    //  * TODO may be a list
    //  */
    // GetZoneType: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetZoneType', cmd, offset)
    //     };
    // },

    // SetDefense: function (pos, hmdef = '00:00', hmundef = '00:00') {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Def'] = types.STR(hmdef);
    //     cmd['Undef'] = types.STR(hmundef);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetDefense', cmd)
    //     };
    // },

    // SetEmail: function (ip, port, user, pwd, emailsend, emailrecv) {
    //     var cmd = {};
    //     cmd['Ip'] = types.STR(ip);
    //     cmd['Port'] = types.S32(port);
    //     cmd['User'] = types.STR(user);
    //     cmd['Pwd'] = types.PWD(pwd);
    //     cmd['EmailSend'] = types.STR(emailsend);
    //     cmd['EmailRecv'] = types.STR(emailrecv);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetEmail', cmd)
    //     };
    // },

    // SetGprs: function (apn, user, pwd) {
    //     var cmd = {};
    //     cmd['Apn'] = types.STR(apn);
    //     cmd['User'] = types.STR(user);
    //     cmd['Pwd'] = types.PWD(pwd);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetGprs', cmd)
    //     };
    // },

    // SetNet: function (mac, name, ip, gate, subnet, dns1, dns2) {
    //     var cmd = {};
    //     cmd['Mac'] = types.MAC(mac);
    //     cmd['Name'] = types.STR(name);
    //     cmd['Ip'] = types.IPA(ip);
    //     cmd['Gate'] = types.IPA(gate);
    //     cmd['Subnet'] = types.IPA(subnet);
    //     cmd['Dns1'] = types.IPA(dns1);
    //     cmd['Dns2'] = types.IPA(dns2);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetNet', cmd)
    //     };
    // },

    // SetOverlapZone: function (pos, zone1, zone2, time) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Zone1'] = types.S32(zone1, 1);
    //     cmd['Zone1'] = types.S32(zone2, 1);
    //     cmd['Time'] = types.S32(time, 1);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetOverlapZone', cmd)
    //     };
    // },

    // SetPairServ: function (ip, port, uid, pwd) {
    //     var cmd = {};
    //     cmd['Ip'] = types.IPA(ip);
    //     cmd['Port'] = types.S32(port, 1);
    //     cmd['Id'] = types.STR(uid);
    //     cmd['Pwd'] = types.PWD(pwd);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetPairServ', cmd)
    //     };
    // },

    // SetPhone: function (pos, num) {
    //     var cmd = {};
    //     cmd['Type'] = types.TYP(1, ['F', 'L']);
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Num'] = types.STR(num);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetPhone', cmd)
    //     };
    // },

    // SetRfid: function (pos, code, typ, msg) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Type'] = types.S32(typ, ['NO', 'DS', 'HS', 'DM', 'HM', 'DC']);
    //     cmd['Code'] = types.STR(code);
    //     cmd['Msg'] = types.STR(msg);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetRfid', cmd)
    //     };
    // },

    // SetRemote: function (pos, code) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Code'] = types.STR(code);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetRemote', cmd)
    //     };
    // },

    // SetSendby: function (cid, tel, voice, sms, email) {
    //     var cmd = {};
    //     cmd['Cid'] = types.STR(cid);
    //     cmd['Tel'] = types.BOL(tel);
    //     cmd['Voice'] = types.BOL(voice);
    //     cmd['Sms'] = types.BOL(sms);
    //     cmd['Email'] = types.BOL(email);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetSendby', cmd)
    //     };
    // },

    // SetSensor: function (pos, code) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Code'] = types.STR(code);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetSensor', cmd)
    //     };
    // },

    // SetServ: function (en, ip, port, name, pwd, cnt) {
    //     var cmd = {};
    //     cmd['En'] = types.BOL(en);
    //     cmd['Ip'] = types.STR(ip);
    //     cmd['Port'] = types.S32(port, 1);
    //     cmd['Name'] = types.STR(name);
    //     cmd['Pwd'] = types.PWD(pwd);
    //     cmd['Cnt'] = types.S32(cnt, 1);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetServ', cmd)
    //     };
    // },

    // SetSwitch: function (pos, code) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Code'] = types.STR(code);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetSwitch', cmd)
    //     };
    // },

    // SetSwitchInfo: function (pos, name, hmopen = '00:00', hmclose = '00:00') {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Name'] = types.STR(name.substring(0, 7).encode('hex'));
    //     cmd['Open'] = types.STR(hmopen);
    //     cmd['Close'] = types.STR(hmclose);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetSwitchInfo', cmd)
    //     };
    // },

    // SetSys: function (indelay, outdelay, alarmtime, wlloss, acloss, comloss, armvoice, armreport, forcearm, doorcheck, breakcheck, alarmlimit) {
    //     var cmd = {};
    //     cmd['InDelay'] = types.S32(indelay, 1);
    //     cmd['OutDelay'] = types.S32(outdelay, 1);
    //     cmd['AlarmTime'] = types.S32(alarmtime, 1);
    //     cmd['WlLoss'] = types.S32(wlloss, 1);
    //     cmd['AcLoss'] = types.S32(acloss, 1);
    //     cmd['ComLoss'] = types.S32(comloss, 1);
    //     cmd['ArmVoice'] = types.BOL(armvoice);
    //     cmd['ArmReport'] = types.BOL(armreport);
    //     cmd['ForceArm'] = types.BOL(forcearm);
    //     cmd['DoorCheck'] = types.BOL(doorcheck);
    //     cmd['BreakCheck'] = types.BOL(breakcheck);
    //     cmd['AlarmLimit'] = types.BOL(alarmlimit);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetSys', cmd)
    //     };
    // },

    // SetTel: function (en, code, cnt) {
    //     var cmd = {};
    //     cmd['Typ'] = types.TYP(0, ['F', 'L']);
    //     cmd['En'] = types.BOL(en);
    //     cmd['Code'] = types.NUM(code);
    //     cmd['Cnt'] = types.S32(cnt, 1);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetTel', cmd)
    //     };
    // },

    // SetTime: function (en, name, typ, time, dst) {
    //     var cmd = {};
    //     cmd['En'] = types.BOL(en);
    //     cmd['Name'] = types.STR(name);
    //     cmd['Type'] = 'TYP,0|%d' % typ;
    //     cmd['Time'] = types.DTA(time);
    //     cmd['Dst'] = types.BOL(dst);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetTime', cmd)
    //     };
    // },

    // SetZone: function (pos, typ, voice, name, bell) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['Type'] = types.TYP(typ, ['NO', 'DE', 'SI', 'IN', 'FO', 'HO24', 'FI', 'KE', 'GAS', 'WT']);
    //     cmd['Voice'] = types.TYP(voice, ['CX', 'MC', 'NO']);
    //     cmd['Name'] = types.STR(name);
    //     cmd['Bell'] = types.BOL(bell);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SetZone', cmd)
    //     };
    // },

    // WlsStudy: function () {
    //     var cmd = {};
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/WlsStudy', cmd)
    //     };
    // },

    // ConfigWlWaring: function () {
    //     var cmd = {};
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/ConfigWlWaring', cmd)
    //     };
    // },

    // FskStudy: function (en) {
    //     var cmd = {};
    //     cmd['Study'] = types.BOL(en);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/FskStudy', cmd)
    //     };
    // },

    // GetWlsStatus: function (num) {
    //     var cmd = {};
    //     cmd['Num'] = types.S32(num);
    //     cmd['Bat'] = null;
    //     cmd['Tamp'] = null;
    //     cmd['Status'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/GetWlsStatus', cmd)
    //     };
    // },

    // DelWlsDev: function (num) {
    //     var cmd = {};
    //     cmd['Num'] = types.S32(num);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/DelWlsDev', cmd)
    //     };
    // },

    // WlsSave: function (typ, num, code) {
    //     var cmd = {};
    //     cmd['Type'] = 'TYP,NO|%d' % typ;
    //     cmd['Num'] = types.S32(num, 1);
    //     cmd['Code'] = types.STR(code);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/WlsSave', cmd)
    //     };
    // },

    // /**
    //  * ????
    //  * @param {*} offset 
    //  */
    // GetWlsList: function (offset) {
    //     var cmd = {};
    //     cmd['Total'] = null;
    //     cmd['Offset'] = types.S32(offset || 0);
    //     cmd['Ln'] = null;
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         offset: offset,
    //         isList: true, //enable list handler
    //         message: _prepareMessage('/Root/Host/GetWlsList', cmd, offset)
    //     };
    // },

    // SwScan: function () {
    //     var cmd = {};
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/SwScan', cmd)
    //     };
    // },


    // OpSwitch: function (self, pos, en) {
    //     var cmd = {};
    //     cmd['Pos'] = types.S32(pos, 1);
    //     cmd['En'] = types.BOL(en);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         seq: 0,
    //         message: _prepareMessage('/Root/Host/OpSwitch', cmd)
    //     };
    // },

    // /**
    //  * Reset the alarm to factory default or reboot??
    //  * @param {*} ret 
    //  * @returns 
    //  */
    // Reset: function (ret) {
    //     var cmd = {};
    //     cmd['Ret'] = types.BOL(ret);
    //     cmd['Err'] = null;
    //     //request
    //     return {
    //         //isList: true,
    //         message: _prepareMessage('/Root/Host/Reset', cmd)
    //     };
    // }

}
