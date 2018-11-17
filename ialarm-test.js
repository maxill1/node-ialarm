
const iAlarm = require('./ialarm.js');

var args = {};
process.argv.slice(2).forEach(function (val, index, array) {
  if(val.indexOf("=")>-1){
    var a = val.split("=");
    args[a[0]] = a[1];
  }
});

//TEST
var host = args["host"] || '192.168.1.81';
var port = args["port"] || 80;
var username = args["username"];
var password = args["password"];

if(!username || !password){
  console.log("Please provide a valid username and password: node ialarm-test username=myuser password=mypassword");
  return;
}

console.log("will test iAlarm on "+host+":"+port);

const alarm = new iAlarm(host, port, username, password);

alarm.on('command', function (commandResponse) {
  console.log("command: "+JSON.stringify(commandResponse));
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
  console.log(new Date().toString() +" status: "+status.status);
  var relevantEvents = alarm.filterStatusZones(status.zones);
  if(relevantEvents.length>0){
      console.log("zone events: "+JSON.stringify(relevantEvents, null, 2));
  }
});
alarm.on('zoneInfo', function (zoneInfo) {
  console.log("zoneInfo: "+JSON.stringify(zoneInfo));

  setTimeout(function(){
    if(zoneInfo.id){
      try {
        var next = parseInt(zoneInfo.id)+1;
        //max 40
        if(next == 40){
          return;
        }
        alarm.getZoneInfo(next);
      } catch (e) {
      }
    }
  },
  500);
});

alarm.getZoneInfo('1');


//alarm.armStay();
//alarm.disarm();
//alarm.getEvents();
//alarm.getStatus();

/*
setInterval(function(){
  alarm.getStatus();
}, 1000);
*/
