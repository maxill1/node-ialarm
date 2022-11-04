import TestSocket from './test-utils.js'

const args = {}
process.argv.slice(2).forEach(function (val) {
  if (val.indexOf('=') > -1) {
    const a = val.split('=')
    args[a[0]] = a[1]
  }
})

// TEST
const host = args.host || '192.168.1.81'
const port = args.port || 18034
const username = args.username
const password = args.password
const zones = args.zones

// TODO commands not implemented/tested/formatted yet
// GetPhone();
// GetWlsList()
// GetWlsStatus(15);
// GetSensor();
// GetEvents();
// GetSensor();
// GetZoneType();
// GetDefense();
// WlsStudy();
// ConfigWlWaring();
// FskStudy(true);
// GetWlsStatus(0);
// GetWlsList();
// SwScan();
// GetSwitch();
// SetSwitchInfo(0, 'Switch0', '01:23', '12:34');
// GetSwitchInfo();
// OpSwitch(0, false);
// GetByWay();
// GetDefense();
// GetEmail();
// GetEvents();
// GetGprs(1100);
// GetNet();
// GetOverlapZone();
// GetPairServ();
// GetPhone();
// GetRemote();
// GetRfid();
// GetRfidType();
// GetSendby(1100);
// GetSensor();
// GetServ();
// GetSwitch();
// GetSwitchInfo();
// GetSys();
// GetTel();
// GetTime();
// GetVoiceType();
// GetZoneType();
// OpSwitch(0, false);
// OpSwitch(0, true);
// OpSwitch(1, false);
// OpSwitch(1, true);
// Reset(0);

// test all
TestSocket(host, port, username, password, zones, [
  /* {
    command: 'GetNet'
  },
  {
    command: 'GetAlarmStatus'
  },
  {
    command: 'GetZone'
  },
  {
    command: 'GetLog'
  },
  {
    command: 'GetArea'
  },

  {
    command: 'GetArea',
    args: [[0, true]]
  },
  {
    command: 'SetArea',
    args: [[0, MeianStatusDecoder.fromStatusToTcpValue('ARMED_HOME')]]
  },
  {
    command: 'SetArea',
    args: [[0, MeianStatusDecoder.fromStatusToTcpValue('DISARMED')]]
  },

  {
    command: 'SetAlarmStatus',
    args: [[MeianStatusDecoder.fromStatusToTcpValue('ARMED_HOME')]]
  },
  {
    command: 'GetByWay'
  },   */
  {
    command: 'SetByWay',
    args: [[2, false]]
  }
  /*
  {
    command: 'SetAlarmStatus',
    args: [[MeianStatusDecoder.fromStatusToTcpValue('DISARMED')]]
  },
  {
    command: ['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone']
  }   */
])
