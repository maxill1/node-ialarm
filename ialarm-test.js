
const iAlarm = require('./ialarm.js');

//TEST
var host = '192.168.1.81';
var port = 80;
var username = "xxxx";
var password = "xxxx";

const alarm = new iAlarm(host, port, username, password);

alarm.on('command', function (commandResponse) {
  console.log("command: "+commandResponse);
});
alarm.on('response', function (response) {
  //console.log("Responded: "+response);
});
alarm.on('error', function (err) {
  console.log("error: "+err);
});

alarm.on('events', function (events) {
  console.log("events: "+JSON.stringify(events));
});

alarm.on('status', function (status) {
  console.log("status: "+JSON.stringify(status));
});

//alarm.armStay();
//alarm.disarm();
alarm.getEvents();
alarm.getStatus();
