
const http = require('http');
const querystring = require('querystring');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const cheerio = require('cheerio');

function iAlarm(host, port, username, password){

  var self = this;

  try {

      const alarmStatus = {
          "1":"ARMED_AWAY",
          "2":"ARMED_STAY",
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

      function decodeZoneMsg(ZoneMsg, i){
        let st = "OK";
        if(ZoneMsg[i-1] & 3){
            st = i + " zone alarm";
        }
        if(ZoneMsg[i-1] & 8){
            st = i + " zone bypass";
        }
        else if(ZoneMsg[i-1] & 16){
            st = i + " zone fault";
        }
        if((ZoneMsg[i-1] & 32)&&((ZoneMsg[i-1] & 8)==0)){
            st = i + " wireless detector low battery";
        }
        if((ZoneMsg[i-1] & 64)&&((ZoneMsg[i-1] & 8)==0)){
            st = i + " wireless detector loss";
        }
        //console.log("Checking msg for zone " + i + ": "+st);
        return st;
      }

      function parseZoneMsg(line){
        let zones = [];

        let start = line.indexOf('(')+1;
        let end = line.indexOf(')');
        let ZoneMsg = line.substring(start,end);
        ZoneMsg = ZoneMsg.split(",");
        for (let i = 0; i < ZoneMsg.length; i++) {
          let msg = decodeZoneMsg(ZoneMsg, i);
          if(msg){
            //1 based
            zones.push({id: i+1, message: msg});
          }
        }

        return zones;
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
          options.headers['Content-Length'] = postData.length;
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
        var path = '/RemoteCtr.htm';
        const _acceptedStatusCode = 302;

        //preparing http post
        const req = http.request(getOptions('POST', _path, _postData), function (res) {
          if(res.statusCode !== _acceptedStatusCode){
            self.emit('error', _path+ " returned an http status code "+ res.statusCode);
            return;
          }

          var result = '';
          res.on('data', function (chunk) {
            result += chunk;
          });
          res.on('end', function () {
            self.emit('response', result);
            getStatus('command');
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
      }

      self.armAway = function(){
        sendCommand("ARMED_AWAY");
      }
      self.armStay = function(){
        sendCommand("ARMED_STAY");
      }
      self.disarm = function(){
        sendCommand("CANCEL");
      }
      self.cancel = function(){
        sendCommand("ARMED_AWAY");
      }
      //TODO test
      self.trigger = function(){
        sendCommand("TRIGGERED");
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
              ZoneMsg = ZoneMsg.split(",");
              for (var i = 0; i < ZoneMsg.length; i++) {
                var msg = decodeZoneMsg(ZoneMsg, i);
                if(msg){
                  //1 based
                  data.zones.push({id: i+1, message: msg});
                }
              }
              break;
            }
          }

          self.emit(eventName, data);
        })
      }


  } catch (e) {
      self.emit('error', e);
  }

}
util.inherits(iAlarm, EventEmitter);

module.exports = iAlarm;
