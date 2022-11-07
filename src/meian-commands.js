
import { MeianDataTypes, MeianMessage, TYP, MeianMessageCleaner } from './meian-message.js'
import MeianStatusDecoder from './meian-status-decoder.js'
import MeianConstants from './meian-constants.js'

/**
 * Handled message commands
 */
export const MeianCommands = {
  /**
   * Login
   * @param {*} uid user id
   * @param {*} pwd password
   * @returns data response
   */
  Client: {
    message: function (uid, pwd) {
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
        message: MeianMessage.prepareMessage('/Root/Pair/Client', cmd)
      }
    },
    formatter: MeianMessageCleaner.default
  },
  /**
   * Push subscribe
   * @param {*} uid uid for subscription
   * @returns data response
   */
  Push: {
    message: function (uid) {
      const cmd = {}
      cmd.Id = MeianDataTypes.STR(uid)
      cmd.Err = null
      // request
      return {
        seq: 0,
        message: MeianMessage.prepareMessage('/Root/Pair/Push', cmd)
      }
    },
    /**
     * This formats the "Alarm" command response:
     *
```xml
<Root>
  <Host>
    <Alarm>
      <Cid>STR,4|3441</Cid>
      <Content>STR,12|M. Partielle</Content>
      <Time>DTA|2018.09.02.01.12.01</Time>
      <Zone>S32,0,99|70</Zone>
      <ZoneName>STR,16|</ZoneName>
      <Name>STR,15|ORION IP2 </Name>
      <Err/>
    </Alarm>
  </Host>
</Root>
```
    */
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, function (hostData) {
        const event = hostData.Cid && MeianMessageCleaner.cleanData(hostData.Cid.value)
        return {
          cid: MeianConstants.cid[event] || event,
          content: hostData.Content && MeianMessageCleaner.cleanData(hostData.Content.value),
          time: hostData.Time && MeianMessageCleaner.cleanData(hostData.Time.value),
          zone: hostData.Zone && MeianMessageCleaner.cleanData(hostData.Zone.value),
          zoneName: hostData.ZoneName && MeianMessageCleaner.cleanData(hostData.ZoneName.value),
          name: hostData.Name && MeianMessageCleaner.cleanData(hostData.Name.value)

        }
      },
      undefined,
      'Alarm')
    }
  },
  /**
   * Get current alarm status
   * @returns data response
   */
  GetAlarmStatus: {
    message: function () {
      const cmd = {}
      cmd.DevStatus = null
      cmd.Err = null
      // request
      return {
        seq: 0,
        message: MeianMessage.prepareMessage('/Root/Host/GetAlarmStatus', cmd)

      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, (hostData) => {
        const status = hostData.DevStatus.value
        const exec = TYP.exec(status)
        return MeianStatusDecoder.fromTcpValueToStatus(exec[2])
      })
    }
  },

  /**
   * Get area status (Alarm areas used by Focus FC-7688Plus, not working in Meian ST-IVCGT)
   * @param {*} offset request offset
   * @returns data response
   */
  GetArea: {
    message: function (offset) {
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
        message: MeianMessage.prepareMessage('/Root/Host/GetArea', cmd)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, function (lineValue, key, lineNumber, lineTotal, offset, elementIndex) {
        const line = {}
        // if (!lineValue) {
        //   console.log('no lineValue')
        // }
        // line.queryNumber = lineNumber + '/' + lineTotal + '-' + offset + '('+key+')';
        line.id = (elementIndex + 1) // base 1
        line.area = line.id
        line.status = MeianMessageCleaner.cleanData(lineValue.Status.value)
        return line
      },
      'areas')
    }
  },

  /**
   * Set area status
   * @param {*} numArea number of aread
   * @param {*} status status (arm, disarm, stay, clear)
   * @returns data response
   */
  SetArea: {
    message: function (numArea, status) {
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
        message: MeianMessage.prepareMessage('/Root/Host/SetArea', cmd)
      }
    },
    formatter: MeianMessageCleaner.default
  },

  /**
    * get sensor status (alarm/open/closed, problem, lowbat, bypass, etc)
    * @param {*} offset request offset
    * @returns data response
    */
  GetByWay: {
    message: function (offset) {
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
        message: MeianMessage.prepareMessage('/Root/Host/GetByWay', cmd, offset)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, function (lineValue, key, lineNumber, lineTotal, offset, elementIndex) {
        if (!lineValue || !lineValue.value) {
          console.log(JSON.stringify(lineValue))
        }
        const status = MeianMessageCleaner.cleanData(lineValue.value)

        const booleansAndMessage = MeianStatusDecoder.getZoneStatus(status)
        const zone = {
          id: elementIndex + 1,
          name: key,
          status,
          ...booleansAndMessage
        }

        return zone
      }, 'zones')
    }
  },

  /**
     * All zones status (fault, battery, loss, etc)
     * @param {*} offset request offset
     */
  GetZone: {
    message: function (offset) {
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
        message: MeianMessage.prepareMessage('/Root/Host/GetZone', cmd, offset)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, function (lineValue, key, lineNumber, lineTotal, offset, elementIndex) {
        const line = {}
        line.id = (elementIndex + 1) // base 1
        line.zone = line.id
        line.name = MeianMessageCleaner.cleanData(lineValue.Name.value)
        line.typeId = MeianMessageCleaner.cleanData(lineValue.Type.value)
        line.type = MeianConstants.ZoneTypes[line.typeId]
        line.voiceId = MeianMessageCleaner.cleanData(lineValue.Voice.value)
        line.voiceName = MeianConstants.ZoneVoices[line.voiceId]
        return line
      },
      'zones')
    }
  },

  /**
     * List of events recorded in the alarm (arm, disarm, bypass, alert, etc). The list is composed by 512 events and every message contains 2 of them: it may take some time to get the full list
     * @param {*} offset request offset
     */
  GetLog: {
    message: function (offset) {
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
        message: MeianMessage.prepareMessage('/Root/Host/GetLog', cmd, offset)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, function (lineValue, key, lineNumber, lineTotal, offset, elementIndex) {
        const line = {}
        line.date = MeianMessageCleaner.cleanData(lineValue.Time.value)
        line.zone = MeianMessageCleaner.cleanData(lineValue.Area.value)
        const event = MeianMessageCleaner.cleanData(lineValue.Event.value)
        line.message = MeianConstants.cid[event] || event
        return line
      },
      'logs')
    }
  },

  /**
     *  Network config (mac address, ip, etc) and alarm name
     * @returns data response
     */
  GetNet: {
    message: function () {
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
        message: MeianMessage.prepareMessage('/Root/Host/GetNet', cmd)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, (hostData) => {
        const network = {}
        for (const key in hostData) {
          const element = hostData[key]
          const prop = key.toLowerCase()
          if (element.value) {
            const value = MeianMessageCleaner.cleanData(element.value)
            network[prop] = value && value.trim && value.trim()
          } else {
            network[prop] = ''
          }
        }
        return network
      })
    }
  },

  /**
   * Set current alarm status
   * @param {*} status status (arm, disarm, stay, clear)
   * @returns data response
   */
  SetAlarmStatus: {
    message: function (status) {
      // 0,1,2
      const cmd = {}
      cmd.DevStatus = MeianDataTypes.TYP(status, ['ARM', 'DISARM', 'STAY', 'CLEAR'])
      cmd.Err = null
      // request
      return {
        seq: 0,
        message: MeianMessage.prepareMessage('/Root/Host/SetAlarmStatus', cmd)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, (hostData) => {
        const status = hostData.DevStatus.value
        const exec = TYP.exec(status)
        return MeianStatusDecoder.fromTcpValueToStatus(exec[2])
      })
    }
  },

  /**
     * Set bypass for sensor
     * @param {*} zone zone index
     * @param {*} bypassed true or false
     */
  SetByWay: {
    message: function (zone, bypassed) {
      const cmd = {}
      cmd.Pos = MeianDataTypes.S32(zone, 1)
      cmd.En = MeianDataTypes.BOL(bypassed)
      cmd.Err = null
      // request
      return {
        seq: 0,
        message: MeianMessage.prepareMessage('/Root/Host/SetByWay', cmd)
      }
    },
    formatter: function (response) {
      return MeianMessageCleaner.parseData(response, (hostData) => {
        return {
          zone: MeianMessageCleaner.cleanData(hostData.Pos.value),
          bypass: MeianMessageCleaner.cleanData(hostData.En.value) === 'T'
        }
      })
    }
  }

  // NOT TESTED

  // /**
  //  * AlarmEvent.htm
  //  * TODO may be a list
  //  */
  // GetEvents: { message :function () {
  //     var cmd = {};
  //     cmd['Total'] = null;
  //     cmd['Offset'] = MeianDataTypes.S32(0);
  //     cmd['Ln'] = null;
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/GetEvents', cmd)
  //     };
  // },
  // formatter: function (response) {
  //   return MeianMessageCleaner.parseData(response, (hostData) => {
  //     const response = {
  //       events: []
  //     }
  //     for (const key in hostData) {
  //       const element = hostData[key]
  //       if (element.value) {
  //         const value = MeianMessageCleaner.cleanData(element.value)
  //         _listBasedFormatter(key, value, response, 'events', function (lineValue) {
  //           return MeianConstants.cid[lineValue]
  //         })
  //       }
  //     }
  //     return response
  //   })
  // }
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetGprs', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetDefense', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetEmail', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetOverlapZone', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetPairServ', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetPhone', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetRemote', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetRfid', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetRfidType', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetSendby', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetSensor', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetServ', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetSwitch', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetSwitchInfo', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetSys', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetTel', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetTime', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetVoiceType', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetZoneType', cmd, offset)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetDefense', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetEmail', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetGprs', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetNet', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetOverlapZone', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetPairServ', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetPhone', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetRfid', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetRemote', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetSendby', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetSensor', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetServ', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetSwitch', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetSwitchInfo', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetSys', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetTel', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetTime', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/SetZone', cmd)
  //     };
  // },

  // WlsStudy: function () {
  //     var cmd = {};
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/WlsStudy', cmd)
  //     };
  // },

  // ConfigWlWaring: function () {
  //     var cmd = {};
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/ConfigWlWaring', cmd)
  //     };
  // },

  // FskStudy: function (en) {
  //     var cmd = {};
  //     cmd['Study'] = MeianDataTypes.BOL(en);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/FskStudy', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetWlsStatus', cmd)
  //     };
  // },

  // DelWlsDev: function (num) {
  //     var cmd = {};
  //     cmd['Num'] = MeianDataTypes.S32(num);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/DelWlsDev', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/WlsSave', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/GetWlsList', cmd, offset)
  //     };
  // },

  // SwScan: function () {
  //     var cmd = {};
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         seq: 0,
  //         message: MeianMessage.prepareMessage('/Root/Host/SwScan', cmd)
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
  //         message: MeianMessage.prepareMessage('/Root/Host/OpSwitch', cmd)
  //     };
  // },

  // /**
  //  * Reset the alarm to factory default or reboot??
  //  * @param {*} ret
  //  * @returns data response
  //  */
  // Reset: function (ret) {
  //     var cmd = {};
  //     cmd['Ret'] = MeianDataTypes.BOL(ret);
  //     cmd['Err'] = null;
  //     //request
  //     return {
  //         //isList: true,
  //         message: MeianMessage.prepareMessage('/Root/Host/Reset', cmd)
  //     };
  // }

}

// sends "Push" than listen for any "Alarm" response
MeianCommands.Alarm = MeianCommands.Push
