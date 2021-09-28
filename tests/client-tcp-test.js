
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
    //alarm.getAlarmStatus();
    //alarm.setAlarmStatus(1);
    alarm.getZone();
    //alarm.getEvents();
    //alarm.getLog();
    //alarm.getSensor();
    //alarm.getZoneType();
    //alarm.getDefense();

});
alarm.on('disconnected', function (response) {
    console.log('Disconnected: ' + JSON.stringify(response));
});

alarm.connect();

setTimeout(function () {
    alarm.disconnect();

}, 40000);
