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

```javascript
const iAlarm = require('ialarm'); 
const alarm = new iAlarm("192.168.1.81", "18034", "myAdmin", "myPassword", [1,2,5,10,15]);

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
```json
{
    "status": "ARMED_HOME", // ARMED_AWAY,ARMED_HOME,DISARMED,CANCEL,TRIGGERED
    "zones": [
        {
            "lastChecked": "2021-10-09T06:45:52.770Z", //last checked 
            "id": 1, //zone number
            "zone": 1, //same as id
            "name": "Ingresso", //zone friendly name
            "status": 1, //tcp zone status (used to decode ok, alarm, bypass, lowbatt, fault, wirelessLoss, etc)
            "inUse": true, //inUse=false means that the zone is disabled on the alarm 
            "alarm": false, //sensor triggered
            "bypass": false, //sensor bypassed
            "lowbat": false, //low battery detected
            "fault": false, //it means the sensors is open
            "wirelessLoss": false, //it means the alarm lost connection to this sensor
            "ok": true, // if all the above are false
            "problem": false, // just the negation of "ok" 
            "message": "OK", //message decoded from "status" property
            "typeId": 1, //zone type id
            "type": "Ritardata",  //zone type name, decoded from typeId
            "voiceId": 1, //alarm bell type
            "voiceName": "Fisso" //alarm bell type name, decoded from voiceId
        }
    ]
}
```

#### getEvents
the last 100 events recorded in the host
```json
{
    "date": "2021-11-09T07:35:38.000Z",
    "zone": 70,
    "message": "Disarm report",
    "description": "Disarm report (zone 70)"
}
```
#### getZoneInfo
without arguments `getZoneInfo()`it returns the configuration of the zones found on the host. You can filter a single zone using argument 0: `getZoneInfo(1)`.
 
```json
    {
        "id": 1, //zone number
        "zone": 1, //same as id
        "name": "Ingresso", //zone friendly name
        "typeId": 1, //zone type id
        "type": "Ritardata",  //zone type name, decoded from typeId
        "voiceId": 1, //alarm bell type
        "voiceName": "Fisso" //alarm bell type name, decoded from voiceId
    }
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
