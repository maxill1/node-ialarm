
var testdata = require('./testdata');
var formatters = require('../src/tcp-response-formatters')();
//MeianClient()._send(testdata.INIT.json);
//MeianClient()._receive(testdata.INIT.raw);
//formatters.GetByWay(testdata.GetByWay.Root.Host.GetByWay);
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

const meianClient = require('../ialarm-tcp');

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

const alarm = new meianClient(host, port, username, password);
alarm.on('response', function (response) {
    console.log('Responded: ' + JSON.stringify(response));
});
alarm.on('error', function (err) {
    console.log('error: ' + JSON.stringify(err));
});
alarm.on('connected', function (response) {
    console.log('Connected: ' + JSON.stringify(response));
    //alarm.getPhone();
    //alarm.getWlsList()
    //alarm.getWlsStatus(15);
    //alarm.getSensor();
    //alarm.getByWay();
    //alarm.setByWay(1, true);
    //alarm.getZone();
    //alarm.getEvents();
    //alarm.getLog();
    //alarm.getSensor();
    //alarm.getZoneType();
    //alarm.getDefense();

    // alarm.setAlarmStatus(0);
    // alarm.setAlarmStatus(1);
    // alarm.getAlarmStatus();
    // alarm.wlsStudy();
    // alarm.configWlWaring();
    // alarm.fskStudy(true);
    // alarm.getWlsStatus(0);
    // alarm.getWlsList();
    // alarm.swScan();
    // alarm.getSwitch();
    // alarm.setSwitchInfo(0, 'Switch0', '01:23', '12:34');
    // alarm.getSwitchInfo();
    // alarm.opSwitch(0, false);
    // alarm.getByWay();
    // alarm.getDefense();
    // alarm.getEmail();
    // alarm.getEvents();
    // alarm.getGprs(1100);
    // alarm.getLog();
    // alarm.getNet();
    // alarm.getOverlapZone();
    // alarm.getPairServ();
    // alarm.getPhone();
    // alarm.getRemote();
    // alarm.getRfid();
    // alarm.getRfidType();
    // alarm.getSendby(1100);
    // alarm.getSensor();
    // alarm.getServ();
    // alarm.getSwitch();
    // alarm.getSwitchInfo();
    // alarm.getSys();
    // alarm.getTel();
    // alarm.getTime();
    // alarm.getVoiceType();
    // alarm.getZone();
    // alarm.getZoneType();
    // alarm.getAlarmStatus();
    // alarm.setAlarmStatus(0);
    // alarm.opSwitch(0, false);
    // alarm.opSwitch(0, true);
    // alarm.opSwitch(1, false);
    // alarm.opSwitch(1, true);
    // alarm.reset(0);

    //library specific events (scraper impl compatibility)
    alarm.getStatus();
    // alarm.armAway();
    // alarm.armHome();
    // alarm.armStay();
    // alarm.disarm();
    // alarm.cancel();
    // alarm.bypassZone(1, true);
    // alarm.bypassZone(1, false);
    // alarm.filterStatusZones([2, 6, 8, 16]);
    // alarm.getAllZones();
    // alarm.getZoneInfo(1)
});

alarm.on('events', function (events) {
    console.log("events: " + JSON.stringify(events));
});

alarm.on('status', function (status) {
    console.log(new Date().toString() + " status: " + status.status);
    var relevantEvents = alarm.filterStatusZones(status.zones);
    if (relevantEvents.length > 0) {
        console.log("zone events: " + JSON.stringify(relevantEvents, null, 2));
    }
});

alarm.on('allZones', function (zones) {
    console.log("allZones: " + JSON.stringify(zones));
    setInterval(function () {
        alarm.getStatus();
    }, 5000);
});

alarm.on('zoneInfo', function (zone) {
    console.log("zoneInfo: " + JSON.stringify(zone));
});

alarm.on('zoneInfoError', function (error) {
    console.log("zoneInfoError: " + JSON.stringify(error));
});

alarm.on('disconnected', function (response) {
    console.log('Disconnected: ' + JSON.stringify(response));
});

alarm.connect();

setTimeout(function () {
    alarm.disconnect();
}, 40000);
