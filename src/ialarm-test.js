
const iAlarm = require('./ialarm-client');

var args = {};
process.argv.slice(2).forEach(function (val, index, array) {
	if(val.indexOf('=')>-1){
		var a = val.split('=');
		args[a[0]] = a[1];
	}
});

//TEST
var host = args['host'] || '192.168.1.81';
var port = args['port'] || 18034;
var username = args['username'];
var password = args['password'];
var zones = args['zones']?JSON.parse(args['zones']):undefined;

if(!username || !password){
	console.log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword');
	return;
}

console.log('will test iAlarm on '+host+':'+port);

const alarm = new iAlarm(host, port, username, password);
alarm.on('response', function (response) {
	console.log('Responded: '+JSON.stringify(response));
});
alarm.on('error', function (err) {
	console.log('error: '+JSON.stringify(err));
});
alarm.on('connected', function (response) {
	console.log('Conencted: '+JSON.stringify(response));
	alarm.getAlarmStatus();
});
alarm.on('disconnected', function (response) {
	console.log('Disconnected: '+JSON.stringify(response));
});

alarm.connect();

setTimeout(function(){
	alarm.disconnect();

}, 40000);

//var testdata = require('./testdata');
//MeianClient()._send(testdata.INIT.json);
//MeianClient()._receive(testdata.INIT.raw);

/*
const messageHandler = MeianMessage()
const tcpMessage = messageHandler.createMessage(INIT.xml)
console.log('Created message ' + tcpMessage)
const xml = messageHandler.extractMessage(tcpMessage)
console.log('Decoded message ' + xml)
*/
