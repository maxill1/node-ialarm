# node-ialarm
A node library to control iAlarm (https://www.antifurtocasa365.it/) or other chinese 'TCP IP' alarm system like Meian and Emooluxr

inspired by these projects 
* https://github.com/RyuzakiKK/pyialarm
* https://github.com/wildstray/meian-client

## Installation
```
npm install node-ialarm
```

## iAlarm functions
### constructor
You have to provide 5 arguments:
- host
- port
- admin
- password
- number of zones/array of zones id (optional, default is 40, can be a number or an array of number)

```javascript
const iAlarm = require('ialarm'); 
const alarm = new iAlarm("192.168.1.81", "80", "myAdmin", "myPassword", [1,2,5,10,15]);

alarm.getStatus().then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

alarm.getEvents().then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

alarm.getZoneInfo().then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

alarm.getZoneInfo(1).then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

alarm.armStay().then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

//disarm
alarm.disarm().then(function (response) {
    console.log('response: ' + JSON.stringify(response));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

//bypass zone 1
alarm.bypassZone(1, true).then(function (response) {
    console.log('response: ' + JSON.stringify(response));
    //remove bypass on zone 1
    alarm.bypassZone(1, false).then(function (response) {
        console.log('response: ' + JSON.stringify(response));
    }, function (error) {
        console.log('Error: ' + JSON.stringify(error));
    }).catch(err => console.error("Fatal:", err));
}, function (error) {
    console.log('Error: ' + JSON.stringify(error));
}).catch(err => console.error("Fatal:", err));

```

### functions and emitted events
#### getStatus
returns a promise with with the current status and an array of zone statuses
```
{"zones":[{"id":1,"message":"OK"}],"status":"ARMED_HOME"}
```
- status: ARMED_AWAY,ARMED_HOME,DISARMED,CANCEL,TRIGGERED
- zones: 
  - id is the zone number on iAlarm 
  - status is the original status code of web panel (0, 3, 8, 16, etc)
  - ok is status = 0 and grabs from web panel this message: "OK";
  - alarm is status & 3 and grabs from web panel this message: "zone alarm"
  - open is status & 16 and grabs from web panel this message: "zone fault"
  - lowbat is (status & 32)&&((status & 8)==0) and grabs from web panel this message: "wireless detector low battery"  
  - fault is (status & 64)&&((status & 8)==0) and grabs from web panel this message: "wireless detector loss"  
  - message is the web panel grabbed message for zone
//TODO docs for more properties

#### getEvents
the last 100 events recorded in the host
```
{"date":"2018-11-11 07:25:04","zone":"70","message":"Sistema Disarmato"}
```
#### getZoneInfo
the configuration of the 40 zones (or configured number of zones) found on the host.
```
{ "1" : {"id":"1","name":"Porta","type":"Ritardato"}, "2" : {"id":"2","name":"Cucina","type":"Perimetrale"} }
```
#### armAway
arm in away mode the alarm, then return the status exposed by getStatus

#### armStay
arm in stay mode the alarm, then return the status exposed by getStatus

#### disarm
disarm in stay mode the alarm, then return the status exposed by getStatus

#### cancel
cancel the triggered alarm, then return the status exposed by getStatus

#### bypassZone
bypass/remove bypass of a zone, then return the status exposed by getStatus


#### filterStatusZones(zones)
will filter zones with relevant event (zone alarm, bypass, errors, etc). The input must be an array of zones emitted with **getStatus**

## Notes:
1) some features like zone message are based on iAlarm js reverse enginering, so i haven't fully tested them.
2) getAllZones is pretty slow, cause it post 40 requests. Provide a zone number to boost it a little.