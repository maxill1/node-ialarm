
const http = require('follow-redirects').http;
const querystring = require('querystring');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const cheerio = require('cheerio');

function iAlarm(host, port, username, password, numberOfZones){

  var self = this;

  try {

      if(!numberOfZones){
        //ialarm have 40 zones on ui, providing a custom number will speed up the getZones function
        numberOfZones = 40;
      }

      //zone cache
      var zonesDefinitions;

      const alarmStatus = {
          "1":"ARMED_AWAY",
          "2":"ARMED_HOME", //ARMED_STAY
          "3":"DISARMED",
          "4":"CANCEL",
          "5":"TRIGGERED"
      };

      function fromValueToStatus(value){
        let st = alarmStatus[value];
        if(!alarmStatus[value]){
            //console.log("Unknown status for "+value);
            throw "unknown status";
        }
        //console.log("Found status :" + st + "("+value+")");
        return st;
      }

      function fromStatusToValue(st){
        for (let value in alarmStatus) {
          if(alarmStatus[value] === st){
            return value;
          }
        }
        throw "unknown status";
      }

      function decodeZoneMsg(ZoneMsg, i, lastChecked){

        let zoneStatus = ZoneMsg[i];
        let zoneNumber = i+1

        var zone = {id: zoneNumber, status: zoneStatus, lastChecked: lastChecked, message : "unknown"};

        zone.ok = false;
        zone.alarm = false;
        zone.bypass = false;
        zone.lowbat = false;
        zone.fault = false;
        zone.open = false;     

        if(zoneStatus == "0"){
          zone.message = "OK";
          zone.ok = true;
        }
        if(zoneStatus & 3){
            zone.message = "zone alarm";
            zone.alarm = true;
        }
        if(zoneStatus & 8){
            zone.message = "zone bypass";
            zone.bypass = true;
        }
        else if(zoneStatus & 16){
            zone.message = "zone fault";
            zone.open = true; 
            //just a note (and i'm not sure): every sensor reports zone fault when contact i open (windows, etc,). Water sensors do the opposite, open when no water is detected so it may sound like a false positive.
        }
        if((zoneStatus & 32)&&((zoneStatus & 8)==0)){
            zone.message = "wireless detector low battery";
            zone.lowbat = true;
        }
        if((zoneStatus & 64)&&((zoneStatus & 8)==0)){
            zone.message = "wireless detector loss";
            zone.fault = true;
        }

        //console.log("Checking msg for zone " + zoneNumber + " : "+zoneStatus+"="+zoneMessage);
        return zone;
      }

      var getOptions = function(_method, _path, _postData){
        // request option
        let options = {
          host: host,
          port: port,
          method: _method,
          path: _path,
          headers: {
            'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
          }
        };
        if(_method === 'POST'){
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if(_postData){
          options.headers['Content-Length'] = _postData.length;
        }
        return options;
      }

      const get = function(_path, _acceptedStatusCode, _callback){

        //preparing get
        const req = http.request(getOptions('GET', _path), function (res) {
          var result = '';

          if(res.statusCode !== _acceptedStatusCode){
            self.emit('error', _path+ " returned an http status code "+ res.statusCode);
            return;
          }

          res.on('data', function (chunk) {
            result += chunk;
          });
          res.on('end', function () {
            self.emit('response', result);
            _callback(result);
          });
          res.on('error', function (err) {
            console.log(err);
            self.emit('error', err);
          })
        });

        //request error
        req.on('error', function (err) {
          console.log(err);
          self.emit('error', err);
        });

        //sending request
        req.end();
      }

      const sendCommand = function(state){

        const value = fromStatusToValue(state);

        //form
        const postData = querystring.stringify({
          Ctrl: value,
          BypassNum: "00",
          BypassOpt: "0"
        });

        postRemoteCtr(postData);
      }

      const postRemoteCtr= function (postData){
        var path = '/RemoteCtr.htm';

        //preparing http post
        const req = http.request(getOptions('POST', path, postData), function (res) {
          if(res.statusCode !== 302 && res.statusCode !== 200){
            self.emit('error', path+ " returned an http status code "+ res.statusCode);
            return;
          }

          var result = '';
          res.on('data', function (chunk) {
            result += chunk;
          });
          res.on('end', function () {
            self.emit('response', result);
            self.getStatus('command');
          });
          res.on('error', function (err) {
            self.emit('error', err);
          })
        });

        //request error
        req.on('error', function (err) {
          self.emit('error', err);
        });

        //sending request with form data
        req.write(postData);
        req.end();
      };

      self.armAway = function(){
        sendCommand("ARMED_AWAY");
      }
      self.armHome = function(){
        sendCommand("ARMED_HOME");
      }
      self.armStay = function(){
        sendCommand("ARMED_HOME");
      }
      self.disarm = function(){
        sendCommand("DISARMED");
      }
      self.cancel = function(){
        sendCommand("CANCEL");
      }
      self.bypassZone = function(number, bypassed){
        //TODO bypass zone
        /*
        else if(part == "BypassSelect")
        {
            document.getElementById("Ctrl").value = "0";
            s = document.getElementById("ZoneSelect");
            document.getElementById("BypassNum").value =  s.value;
        }*/
        
        var BypassNum =  ("0" + number).slice(-2);
        var BypassOpt = bypassed?'1':'2';

        //form
        const postData = querystring.stringify({
          Ctrl: "0", //not selected
          BypassNum: BypassNum, //00 not selected, 01 zone 1, etc
          BypassOpt: BypassOpt //0 not selected, 1 enabled (bypassed), 2 disabled (active)
        });

        postRemoteCtr(postData);
      }

      self.getEvents = function(){

        get('/SystemLog.htm', 200, function(result){

          const $ = cheerio.load(result)
          var events = [];
          $('tr').each(function(i, elem) {
            var ev = $(this).html();

            var child$ = cheerio.load(this);
            let td = child$('td').map(function () {
              return child$(this).text().trim();
            }).get();

            if(td[0] && td[1] && td[2]){
              var event = {date: td[0], zone: td[1], message: td[2]};
              events.push(event);
            }
          });
          self.emit('events', events);
        })
      }

      self.getStatus = function(eventName){

        if(!eventName){
          eventName = 'status';
        }

        get('/RemoteCtr.htm', 200, function(result){

          const $ = cheerio.load(result)

          var tag = $('option[selected=selected]');
          var value = tag.attr('value');

          var data = {};
          data.zones = [];
          //alarm status
          data.status = fromValueToStatus(value);

          //zones and messages
          var scriptLines = $('script').html().split('\n');

          for (var l = 0; l < scriptLines.length; l++) {
            var line = scriptLines[l];
            //var ZoneMsg = new Array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
            if(line.indexOf("var ZoneMsg")>-1){

              var start = line.indexOf('(')+1;
              var end = line.indexOf(')');
              var ZoneMsg = line.substring(start,end);
              //console.log(ZoneMsg);
              ZoneMsg = ZoneMsg.split(",");

              var lastChecked = new Date();

              for (var i = 0; i < ZoneMsg.length; i++) {
                var zoneData = decodeZoneMsg(ZoneMsg, i, lastChecked);
                if(zoneData){
                  if(zoneData.status==1){
                    data.status = "TRIGGERED";
                  }
                  //1 based
                  data.zones.push(zoneData);
                }
              }
              break;
            }
          }

          self.emit(eventName, data);
        })
      };


      //not very reliable, on concurrent post it will fail on retrieving the posted zone
      self.getZoneInfo = function(zoneNumber){
        //form
        const postData = querystring.stringify({
          zoneNo: zoneNumber.toString(),
          ZnGetPar: 'GetPar'
        });
        var path = '/Zone.htm';

        //preparing http post
        var options = getOptions('POST', path, postData);

        var zones = [];

        const req = http.request(options, function (res) {
            if(res.statusCode !== 302 && res.statusCode !== 200){
            self.emit('error', path+ " returned an http status code "+ res.statusCode);
            return;
          }

          var result = '';
          res.on('data', function (chunk) {
            result += chunk;
          });
          res.on('end', function () {

            //parse data
            //ZoneType 'option[selected=selected]'
            //ZoneName input value

            var id;
            var type;
            var name;
            try {
              //console.log(JSON.stringify(result));
              var $ = cheerio.load(result);

              try {
                var zoneNo = $('select[name=zoneNo]').html();
                //console.log(zoneNo);
                var child$ = cheerio.load(zoneNo);
                id = child$('option[selected=selected]').text();
              } catch (e) {
              }

              try {
                name = $('input[name=ZoneName]').attr('value');
              } catch (e) {
              }

              try {
                var zoneType = $('select[name=ZoneType]').html();
                var child$ = cheerio.load(zoneType);
                type =  child$('option[selected=selected]').text();
              } catch (e) {
              }

            } catch (e) {
              console.log("Errore getZoneInfo "+e.message);
            }

            var zoneInfo = {};
            zoneInfo.id   = id;
            zoneInfo.name = name;
            zoneInfo.type = type;

            zones[zoneInfo.id] = zoneInfo;

            if(id && zoneNumber == id){
              self.emit('zoneInfo', zoneInfo);
            }else{
              var err = "bad response from server: requested "+zoneNumber +" got " +id + "("+name+")";
              self.emit('zoneInfoError', { id: zoneNumber, error: err});
            }
          });
          res.on('error', function (err) {
            self.emit('error', err);
          });
        });

        //request error
        req.on('error', function (err) {
          self.emit('error', err);
        });

        //sending request with form data
        req.write(postData);
        req.end();
      };

      self.getAllZones = function(forceReload){

        function emitZones(){
          //console.log("zoneInfo completed.");
          self.emit('allZones', zonesDefinitions);
        }

        if(forceReload){
          zonesDefinitions = undefined;
        }

        if(zonesDefinitions){
          emitZones();
        }else{
          //populating zones

          var checkZone = function(zoneNumber){
            if(zoneNumber>numberOfZones){
              emitZones();
              return;
            }
            self.getZoneInfo(zoneNumber);
          };

          zonesDefinitions = {};
          var retry = 0;
          var errCount = 0;
          self.on('zoneInfo', function (zoneInfo) {
            //console.log("zoneInfo: "+JSON.stringify(zoneInfo));
            var zoneNumber = zoneInfo.id;
            zonesDefinitions[zoneNumber] = zoneInfo;
            //got name? try again
            if(!zoneInfo.name && retry===0){
              //max 2 retry
              retry++;
              checkZone(zoneNumber);
            }else{
              retry = 0;
              //next
              zoneNumber++;
              checkZone(zoneNumber);
            }
          });

          self.on('zoneInfoError', function (zoneInfoError) {
            errCount++;
            if(errCount>10){
              return;
            }
            //ialarm html server may fail on concurrent requests
            console.log("retring: "+zoneInfoError.id + " - " + zoneInfoError.error);
            checkZone(zoneInfoError.id);
          });


          checkZone(1);

        }
      };


      //only zone with relevant event
      self.filterStatusZones = function(zones){
        if(!zones){
          return [];
        }
        return zones.filter(function (zone) {
          return zone.status != 0;
        });
      }


  } catch (e) {
      self.emit('error', e);
  }

}
util.inherits(iAlarm, EventEmitter);

module.exports = iAlarm;
