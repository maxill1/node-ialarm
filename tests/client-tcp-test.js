
//var testdata = require('./testdata');
//var formatters = require('../src/tcp-response-formatters')();
//MeianClient()._send(testdata.INIT.json);
//MeianClient()._receive(testdata.INIT.raw);
//formatters.GetByWay(testdata.GetByWay.Root.Host.GetByWay);

//2,3,6,16 = zone fault (16 su web)
//var ZoneMsg = new Array(0,16,16,0,0,16,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0);
//console.log(formatters.GetByWay({ "Total": { "value": "S32,0,40|40" }, "Offset": { "value": "S32,0,40|0" }, "Ln": { "value": "S32,0,40|16" }, "L0": { "value": "S32,1,255|1" }, "L1": { "value": "S32,1,255|9" }, "L2": { "value": "S32,1,255|9" }, "L3": { "value": "S32,1,255|1" }, "L4": { "value": "S32,1,255|1" }, "L5": { "value": "S32,1,255|9" }, "L6": { "value": "S32,1,255|1" }, "L7": { "value": "S32,1,255|1" }, "L8": { "value": "S32,1,255|1" }, "L9": { "value": "S32,1,255|1" }, "L10": { "value": "S32,1,255|1" }, "L11": { "value": "S32,1,255|1" }, "L12": { "value": "S32,1,255|1" }, "L13": { "value": "S32,1,255|1" }, "L14": { "value": "S32,1,255|1" }, "L15": { "value": "S32,1,255|9" }, "Err": {} }));
//formatters.GetEvents(testdata.GetEvents.Root.Host.GetEvents);
//formatters.GetLog(testdata.GetLog.Root.Host.GetLog);
//formatters.GetZone(testdata.GetZone.Root.Host.GetZone);


/*
const messageHandler = MeianMessage()
const tcpMessage = messageHandler.createMessage(INIT.xml)
console.log('Created message ' + tcpMessage)
const xml = messageHandler.extractMessage(tcpMessage)
console.log('Decoded message ' + xml)
*/

const meianClient = require('../ialarm');

var args = {};
process.argv.slice(2).forEach(function (val) {
    if (val.indexOf('=') > -1) {
        var a = val.split('=');
        args[a[0]] = a[1];
    }
});

//TEST
var host = args['host'] || '192.168.1.81';
var port = args['port'] || 18034;
var username = args['username'];
var password = args['password'];
//var zones = args['zones']?JSON.parse(args['zones']):undefined;

if (!username || !password) {
    console.log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword');
    return;
}

console.log('will test meianClient on ' + host + ':' + port);


function testLibrary(functionName, arg1, arg2) {
    const alarm = new meianClient(host, port, username, password);
    alarm[functionName](arg1, arg2).then(function (response) {
        console.log('response: ' + JSON.stringify(response));
    }, function (error) {
        console.log('Error: ' + JSON.stringify(error));
    }).catch(err => console.error("Fatal:", err));
}
// implemented
//testLibrary('getEvents');
testLibrary('getStatus');
//testLibrary('getZoneInfo');
//testLibrary('bypassZone', 2, true);
//testLibrary('bypassZone', 2, false);
//testLibrary('armAway');
//testLibrary('armHome');
//testLibrary('disarm');
//testLibrary('cancel');


// function testSocket(commands, commandsArgs) {
//     const MeianSocket = require('../src/meian-socket');
//     MeianSocket(host, port, username, password).executeCommand(commands, commandsArgs).then(function (data) {
//         console.log(JSON.stringify(data));
//     }, function (err) {
//         console.error("Error:", err)
//     }).catch(err => console.error("Fatal:", err));
// }
//testSocket(['GetZone'])
//testSocket(['GetByWay'])
//testSocket(['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone'])

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