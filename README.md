# node-ialarm
A node library to control iAlarm (https://www.antifurtocasa365.it/) or other chinese 'TCP IP' alarm system like Meian and Emooluxr

inspired by python version https://github.com/RyuzakiKK/pyialarm

## Installation
```
npm install node-ialarm
```

## iAlarm functions
### constructor
You have to provide 4 arguments:
- host
- port
- admin
- password
- number of zones (optional, default is 40)

```
const alarm = new iAlarm("192.168.1.81", "80", "myAdmin", "myPassword");
alarm.on('command', function (commandResponse) {
  console.log("command: "+commandResponse);
});
alarm.on('response', function (response) {
  console.log("Responded: "+response);
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

alarm.on('allZones', function (allZones) {
  console.log("allZones: "+JSON.stringify(allZones));
});

alarm.armStay();
alarm.disarm();
alarm.getEvents();
alarm.getStatus();
alarm.getAllZones();
```

### functions and emitted events
#### getStatus
parses **host/RemoteCtr.htm** then emit **status** with the current status and an array of zone statuses and emit **response** with the full body of the http reponse.
```
{"zones":[{"id":1,"message":"OK"}],"status":"ARMED_HOME"}
```
- status: ARMED_AWAY,ARMED_HOME,DISARMED,CANCEL,TRIGGERED
- zones: id is the zone number on iAlarm and message is one of the following: "zone alarm", "zone bypass", "zone fault", "wireless detector low battery", "wireless detector loss"

#### getEvents
parses **host/SystemLog.htm** then emit **events** with the last 24 events recorded in the host and emit **response** with the full body of the http reponse.
```
{"date":"2018-11-11 07:25:04","zone":"70","message":"Sistema Disarmato"}
```
#### getAllZones
parses **host/Zone.htm** then emit **allZones** with the 40 zones (or configured number of zones) found on the host.
```
{ "1" : {"id":"1","name":"Porta","type":"Ritardato"}, "2" : {"id":"2","name":"Cucina","type":"Perimetrale"} }
```

#### armAway
call **host/RemoteCtr.htm** and arm in away mode the alarm, then emit **command** with the status (ARMED_AWAY, DISARMED, etc)

#### armStay
call **host/RemoteCtr.htm** and arm in stay mode the alarm, then emit **command** with the status (ARMED_AWAY, DISARMED, etc)

#### disarm
call **host/RemoteCtr.htm** and disarm the alarm, then emit **command** with the status (ARMED_AWAY, DISARMED, etc)

#### cancel
call **host/RemoteCtr.htm** and cancel the alarm, then emit **command** with the status (ARMED_AWAY, DISARMED, etc)

#### filterStatusZones(zones)
will filter zones with relevant event (zone alarm, bypass, errors, etc). The input must be an array of zones emitted with **getStatus**
```
alarm.on('status', function (status) {
  var relevantEvents = alarm.filterStatusZones(status.zones);
  if(relevantEvents.length>0){
      console.log("zone events: "+JSON.stringify(relevantEvents, null, 2));
  }
});
```

## Notes:
1) some features like zone message are based on iAlarm js reverse enginering, so i haven't fully tested them.
2) getAllZones is pretty slow, cause it post 40 requests. Provide a zone number to boost it a little.
