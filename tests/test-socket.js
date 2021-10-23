const MeianSocket = require('../src/meian-socket')
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
// var zones = args['zones']?JSON.parse(args['zones']):undefined;

if (!username || !password) {
  console.log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword')
} else {
  console.log('will test MeianClient on ' + host + ':' + port)

  function testSocket (commands, commandsArgs) {
    MeianSocket(host, port, username, password).executeCommand(commands, commandsArgs).then(function (data) {
      console.log(JSON.stringify(data))
    }).catch(function (error) {
      console.log('Error: ', error)
    })
  }
  // testSocket(['GetNet'])
  // testSocket(['GetAlarmStatus'])
  testSocket(['GetZone'])
  // testSocket(['GetLog'])
  // testSocket(['GetByWay'])
  // testSocket(['SetByWay'], [[0, true]])
  // testSocket(['GetArea'], [[0]])
  // testSocket(['GetArea'], [[0]])
  // testSocket(['SetArea'], [[0, alarmStatus.fromStatusToTcpValue('ARMED_HOME')]])
  // testSocket(['SetAlarmStatus'], [[alarmStatus.fromStatusToTcpValue('ARMED_HOME')]])
  // testSocket(['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone'])

  // TODO commands not implemented yet
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
}
