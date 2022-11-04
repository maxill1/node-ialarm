import convert from 'xml-js'

const type = function (name, input) {
  const size = input.length
  return `${name},${size}|${input}`
}

export const MeianDataTypes = {
  BOL: function (en) {
    if (en) {
      return 'BOL|T'
    }
    return 'BOL|F'
  },
  DTA: function (date) {
    const dta = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`
    const size = dta.length
    return `DTA,${size}|${dta}`
  },
  PWD: function (pwd) {
    return type('PWD', pwd)
  },
  S32: function (val, pos = 0, max) {
    if (!max) {
      max = pos
    }
    return `S32,${pos},${max}|${val}`
  },
  IPA: function (ip) {
    return type('IPA', ip)
  },
  STR: function (text) {
    return type('STR', text)
  },
  TYP: function (val, typ = []) {
    try {
      const t = typ[val]
      return `TYP,${t}|${val}`
    } catch (error) {
      return `TYP,NONE,|${val}` % val
    }
  }
}

/**
 * 128 bytes key as byte array
 */
const KEY = ((hexString) => {
  const result = []
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substr(i, 2), 16))
  }
  return result
})('0c384e4e62382d620e384e4e44382d300f382b382b0c5a6234384e304e4c372b10535a0c20432d171142444e58422c421157322a204036172056446262382b5f0c384e4e62382d620e385858082e232c0f382b382b0c5a62343830304e2e362b10545a0c3e432e1711384e625824371c1157324220402c17204c444e624c2e12')

const toString = function (bytes) {
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}

const getBytes = function (str) {
  const bytes = str.split('').map(function s (x) { return x.charCodeAt(0) })
  return bytes
}

/**
   * XOR encrypted/decrypted message with a 128 bytes key
   */
const decryptEncrypt = function (message) {
  const bytes = getBytes(message)
  // var str = toString(buf)
  // console.log(str)
  for (let i = 0; i < bytes.length; i++) {
    const ki = i & 0x7f
    bytes[i] = bytes[i] ^ KEY[ki]
  }
  return bytes
}

/**
 * Meian Message builder/parse based on this specs:
 * https://github.com/wildstray/meian-client/wiki
 */

export const MeianMessage = {
  /**
     * Encrypt and build a message
     */
  createMessage: function (xml, sequence, isRequest) {
    if (!sequence) {
      sequence = 1
    }
    const encryptedMessageBytes = decryptEncrypt(xml)
    const encryptedMessage = toString(encryptedMessageBytes)
    const msgType = '@ieM' // First 4 bytes is the message type: There are three message types: 1) get/set ('@ieM') 2) push ('@alA') 3) keepalive ('%maI').
    const msgSize = ('000' + encryptedMessageBytes.length).slice(-4) // next four bytes are size of encrypted data
    const msgSeq = ('000' + sequence).slice(-4) // next four bytes are a sequence number
    const msgFiller = '0000' // next four bytes are always zeroes then there is an encrypted request or response.;
    const msgEnding = !isRequest ? msgSize : '0000' // Last four bytes are size of encrypted data for request, 0000 or -001 for response
    const msg = `${msgType}${msgSize}${msgSeq}${msgFiller}${encryptedMessage}${msgEnding}`
    return msg
  },

  /**
     * Encrypt and build a message
     */
  extractMessage: function (data) {
    // remove head (msg type, size and filler) and tail (msg size or -0001)
    const encryptedMessage = data.substring(0, data.length - 4).substring(16)
    const decryptedMessageBytes = decryptEncrypt(encryptedMessage)
    const message = toString(decryptedMessageBytes)
    return message
  }

}

/**
 * Convert to XML the data, encrypt the message
 */
function _prepareMessage (root, cmd, sequence) {
  const paths = root.split('/')
  const data = {}
  let lastIteratedObj = data
  for (let i = 1; i < paths.length; i++) {
    const key = paths[i]
    lastIteratedObj[key] = {}
    if (i === paths.length - 1) {
      lastIteratedObj[key] = cmd
    }
    lastIteratedObj = lastIteratedObj[key]
  }
  const xml = convert.js2xml(data, { compact: true, fullTagEmptyElement: true, spaces: 0 })
  // console.log('Requesting XML ' + xml);

  const msg = MeianMessage.createMessage(xml, sequence || 1, true)
  // console.log('Requesting RAW ' + msg);

  return msg
}

export const MeianMessageFunctions = {
  /**
     * Login
     */
  Client: function (uid, pwd) {
    const cmd = {}
    cmd.Id = MeianDataTypes.STR(uid)
    cmd.Pwd = MeianDataTypes.PWD(pwd)
    cmd.Type = 'TYP,ANDROID|0'
    cmd.Token = MeianDataTypes.STR(function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = (c === 'x') ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }())
    cmd.Action = 'TYP,IN|0'
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Pair/Client', cmd)
    }
  },
  /**
   * Push subscribe
   * @param {*} uid
   * @param {*} pwd
   * @returns
   */
  Push: function (uid) {
    const cmd = {}
    cmd.Id = MeianDataTypes.STR(uid)
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Pair/Push', cmd)
    }
  },
  /**
    * Get current alarm status
    */
  GetAlarmStatus: function () {
    const cmd = {}
    cmd.DevStatus = null
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Host/GetAlarmStatus', cmd)
    }
  },

  /**
    * Get area status
    * <Root>
    *   <Host>
    *       <GetArea>
    *           <Total/>
    *           <Offset>S32,0,0|0</Offset>
    *           <Ln/>
    *           <Err/>
    *       </GetArea>
    *   </Host>
    * </Root>
    */
  GetArea: function (offset) {
    offset = offset || 0
    const cmd = {}
    cmd.Total = null
    cmd.Offset = MeianDataTypes.S32(offset)
    cmd.Ln = null
    cmd.Err = null
    // request
    return {
      seq: 0,
      offset,
      isList: true,
      message: _prepareMessage('/Root/Host/GetArea', cmd)
    }
  },

  /**
     * Set current alarm status for area
     * <Root>
     *  <Host>
     *      <SetArea>
     *          <Pos>S32,0,3|3</Pos>
     *          <Status>S32,0,0|0</Status>
     *          <Err/>
     *      </SetArea>
     *  </Host>
     * </Root>
     */
  SetArea: function (numArea, status) {
    status = status || 0
    numArea = numArea || 0
    // 0,1,2
    const cmd = {}
    cmd.Pos = MeianDataTypes.S32(numArea, 0, 3) // max 4 aree
    cmd.Status = MeianDataTypes.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR'])
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Host/SetArea', cmd)
    }
  },

  /**
    * get sensor status (alarm/open/closed, problem, lowbat, bypass, etc)
    */
  GetByWay: function (offset) {
    offset = offset || 0

    const cmd = {}
    cmd.Total = null
    cmd.Offset = MeianDataTypes.S32(offset)
    cmd.Ln = null
    cmd.Err = null
    // request
    return {
      seq: 0,
      offset,
      isList: true,
      message: _prepareMessage('/Root/Host/GetByWay', cmd, offset)
    }
  },

  /**
     * All zones status (fault, battery, loss, etc)
     * @param {*} offset
     */
  GetZone: function (offset) {
    offset = offset || 0

    const cmd = {}
    cmd.Total = null
    cmd.Offset = MeianDataTypes.S32(offset || 0)
    cmd.Ln = null
    cmd.Err = null

    // request
    return {
      seq: 0,
      offset,
      isList: true,
      message: _prepareMessage('/Root/Host/GetZone', cmd, offset)
    }
  },

  /**
     * Log, total is max 512 and it may take some time
     * @param {*} offset
     */
  GetLog: function (offset) {
    offset = offset || 0
    const cmd = {}
    cmd.Total = null
    cmd.Offset = MeianDataTypes.S32(offset || 0)
    cmd.Ln = null
    cmd.Err = null

    // request
    return {
      seq: 0,
      offset,
      isList: true,
      message: _prepareMessage('/Root/Host/GetLog', cmd, offset)
    }
  },

  /**
     * Alarm name, mac address and network configuration
     * @returns
     */
  GetNet: function () {
    const cmd = {}
    cmd.Mac = null
    cmd.Name = null
    cmd.Ip = null
    cmd.Gate = null
    cmd.Subnet = null
    cmd.Dns1 = null
    cmd.Dns2 = null
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Host/GetNet', cmd)
    }
  },

  /**
     * Set current alarm status
     */
  SetAlarmStatus: function (status) {
    // 0,1,2
    const cmd = {}
    cmd.DevStatus = MeianDataTypes.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR'])
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Host/SetAlarmStatus', cmd)
    }
  },

  /**
     * Set bypass for sensor
     * @param {*} pos
     * @param {*} en
     */
  SetByWay: function (pos, en) {
    const cmd = {}
    cmd.Pos = MeianDataTypes.S32(pos, 1)
    cmd.En = MeianDataTypes.BOL(en)
    cmd.Err = null
    // request
    return {
      seq: 0,
      message: _prepareMessage('/Root/Host/SetByWay', cmd)
    }
  }

  // NOT TESTED

  // /**
  //  * AlarmEvent.htm
  //  * TODO may be a list
  //  */
  // GetEvents: function () {
  //     var cmd = {};
  //     cmd['Total'] = null;
  //     cmd['Offset'] = MeianDataTypes.S32(0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(0);
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
  //     cmd['Offset'] = MeianDataTypes.S32();
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
  //     cmd['Offset'] = MeianDataTypes.S32(0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Cid'] = MeianDataTypes.STR(cid);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Def'] = MeianDataTypes.STR(hmdef);
  //     cmd['Undef'] = MeianDataTypes.STR(hmundef);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetDefense', cmd)
  //     };
  // },

  // SetEmail: function (ip, port, user, pwd, emailsend, emailrecv) {
  //     var cmd = {};
  //     cmd['Ip'] = MeianDataTypes.STR(ip);
  //     cmd['Port'] = MeianDataTypes.S32(port);
  //     cmd['User'] = MeianDataTypes.STR(user);
  //     cmd['Pwd'] = MeianDataTypes.PWD(pwd);
  //     cmd['EmailSend'] = MeianDataTypes.STR(emailsend);
  //     cmd['EmailRecv'] = MeianDataTypes.STR(emailrecv);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetEmail', cmd)
  //     };
  // },

  // SetGprs: function (apn, user, pwd) {
  //     var cmd = {};
  //     cmd['Apn'] = MeianDataTypes.STR(apn);
  //     cmd['User'] = MeianDataTypes.STR(user);
  //     cmd['Pwd'] = MeianDataTypes.PWD(pwd);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetGprs', cmd)
  //     };
  // },

  // SetNet: function (mac, name, ip, gate, subnet, dns1, dns2) {
  //     var cmd = {};
  //     cmd['Mac'] = MeianDataTypes.MAC(mac);
  //     cmd['Name'] = MeianDataTypes.STR(name);
  //     cmd['Ip'] = MeianDataTypes.IPA(ip);
  //     cmd['Gate'] = MeianDataTypes.IPA(gate);
  //     cmd['Subnet'] = MeianDataTypes.IPA(subnet);
  //     cmd['Dns1'] = MeianDataTypes.IPA(dns1);
  //     cmd['Dns2'] = MeianDataTypes.IPA(dns2);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetNet', cmd)
  //     };
  // },

  // SetOverlapZone: function (pos, zone1, zone2, time) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Zone1'] = MeianDataTypes.S32(zone1, 1);
  //     cmd['Zone1'] = MeianDataTypes.S32(zone2, 1);
  //     cmd['Time'] = MeianDataTypes.S32(time, 1);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetOverlapZone', cmd)
  //     };
  // },

  // SetPairServ: function (ip, port, uid, pwd) {
  //     var cmd = {};
  //     cmd['Ip'] = MeianDataTypes.IPA(ip);
  //     cmd['Port'] = MeianDataTypes.S32(port, 1);
  //     cmd['Id'] = MeianDataTypes.STR(uid);
  //     cmd['Pwd'] = MeianDataTypes.PWD(pwd);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetPairServ', cmd)
  //     };
  // },

  // SetPhone: function (pos, num) {
  //     var cmd = {};
  //     cmd['Type'] = MeianDataTypes.TYP(1, ['F', 'L']);
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Num'] = MeianDataTypes.STR(num);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetPhone', cmd)
  //     };
  // },

  // SetRfid: function (pos, code, typ, msg) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Type'] = MeianDataTypes.S32(typ, ['NO', 'DS', 'HS', 'DM', 'HM', 'DC']);
  //     cmd['Code'] = MeianDataTypes.STR(code);
  //     cmd['Msg'] = MeianDataTypes.STR(msg);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetRfid', cmd)
  //     };
  // },

  // SetRemote: function (pos, code) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Code'] = MeianDataTypes.STR(code);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetRemote', cmd)
  //     };
  // },

  // SetSendby: function (cid, tel, voice, sms, email) {
  //     var cmd = {};
  //     cmd['Cid'] = MeianDataTypes.STR(cid);
  //     cmd['Tel'] = MeianDataTypes.BOL(tel);
  //     cmd['Voice'] = MeianDataTypes.BOL(voice);
  //     cmd['Sms'] = MeianDataTypes.BOL(sms);
  //     cmd['Email'] = MeianDataTypes.BOL(email);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetSendby', cmd)
  //     };
  // },

  // SetSensor: function (pos, code) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Code'] = MeianDataTypes.STR(code);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetSensor', cmd)
  //     };
  // },

  // SetServ: function (en, ip, port, name, pwd, cnt) {
  //     var cmd = {};
  //     cmd['En'] = MeianDataTypes.BOL(en);
  //     cmd['Ip'] = MeianDataTypes.STR(ip);
  //     cmd['Port'] = MeianDataTypes.S32(port, 1);
  //     cmd['Name'] = MeianDataTypes.STR(name);
  //     cmd['Pwd'] = MeianDataTypes.PWD(pwd);
  //     cmd['Cnt'] = MeianDataTypes.S32(cnt, 1);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetServ', cmd)
  //     };
  // },

  // SetSwitch: function (pos, code) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Code'] = MeianDataTypes.STR(code);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetSwitch', cmd)
  //     };
  // },

  // SetSwitchInfo: function (pos, name, hmopen = '00:00', hmclose = '00:00') {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Name'] = MeianDataTypes.STR(name.substring(0, 7).encode('hex'));
  //     cmd['Open'] = MeianDataTypes.STR(hmopen);
  //     cmd['Close'] = MeianDataTypes.STR(hmclose);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetSwitchInfo', cmd)
  //     };
  // },

  // SetSys: function (indelay, outdelay, alarmtime, wlloss, acloss, comloss, armvoice, armreport, forcearm, doorcheck, breakcheck, alarmlimit) {
  //     var cmd = {};
  //     cmd['InDelay'] = MeianDataTypes.S32(indelay, 1);
  //     cmd['OutDelay'] = MeianDataTypes.S32(outdelay, 1);
  //     cmd['AlarmTime'] = MeianDataTypes.S32(alarmtime, 1);
  //     cmd['WlLoss'] = MeianDataTypes.S32(wlloss, 1);
  //     cmd['AcLoss'] = MeianDataTypes.S32(acloss, 1);
  //     cmd['ComLoss'] = MeianDataTypes.S32(comloss, 1);
  //     cmd['ArmVoice'] = MeianDataTypes.BOL(armvoice);
  //     cmd['ArmReport'] = MeianDataTypes.BOL(armreport);
  //     cmd['ForceArm'] = MeianDataTypes.BOL(forcearm);
  //     cmd['DoorCheck'] = MeianDataTypes.BOL(doorcheck);
  //     cmd['BreakCheck'] = MeianDataTypes.BOL(breakcheck);
  //     cmd['AlarmLimit'] = MeianDataTypes.BOL(alarmlimit);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetSys', cmd)
  //     };
  // },

  // SetTel: function (en, code, cnt) {
  //     var cmd = {};
  //     cmd['Typ'] = MeianDataTypes.TYP(0, ['F', 'L']);
  //     cmd['En'] = MeianDataTypes.BOL(en);
  //     cmd['Code'] = MeianDataTypes.NUM(code);
  //     cmd['Cnt'] = MeianDataTypes.S32(cnt, 1);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetTel', cmd)
  //     };
  // },

  // SetTime: function (en, name, typ, time, dst) {
  //     var cmd = {};
  //     cmd['En'] = MeianDataTypes.BOL(en);
  //     cmd['Name'] = MeianDataTypes.STR(name);
  //     cmd['Type'] = 'TYP,0|%d' % typ;
  //     cmd['Time'] = MeianDataTypes.DTA(time);
  //     cmd['Dst'] = MeianDataTypes.BOL(dst);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/SetTime', cmd)
  //     };
  // },

  // SetZone: function (pos, typ, voice, name, bell) {
  //     var cmd = {};
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['Type'] = MeianDataTypes.TYP(typ, ['NO', 'DE', 'SI', 'IN', 'FO', 'HO24', 'FI', 'KE', 'GAS', 'WT']);
  //     cmd['Voice'] = MeianDataTypes.TYP(voice, ['CX', 'MC', 'NO']);
  //     cmd['Name'] = MeianDataTypes.STR(name);
  //     cmd['Bell'] = MeianDataTypes.BOL(bell);
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
  //     cmd['Study'] = MeianDataTypes.BOL(en);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: _prepareMessage('/Root/Host/FskStudy', cmd)
  //     };
  // },

  // GetWlsStatus: function (num) {
  //     var cmd = {};
  //     cmd['Num'] = MeianDataTypes.S32(num);
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
  //     cmd['Num'] = MeianDataTypes.S32(num);
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
  //     cmd['Num'] = MeianDataTypes.S32(num, 1);
  //     cmd['Code'] = MeianDataTypes.STR(code);
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
  //     cmd['Offset'] = MeianDataTypes.S32(offset || 0);
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
  //     cmd['Pos'] = MeianDataTypes.S32(pos, 1);
  //     cmd['En'] = MeianDataTypes.BOL(en);
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
  //     cmd['Ret'] = MeianDataTypes.BOL(ret);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         //isList: true,
  //         message: _prepareMessage('/Root/Host/Reset', cmd)
  //     };
  // }

}
