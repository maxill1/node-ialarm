
var convert = require('xml-js');
var net = require('net');
var MeianMessage = require('./meian-message');
var MeianDataTypes = require('./meian-datatypes');
const util = require('util');
const EventEmitter = require('events').EventEmitter;

function MeianClient (host, port, uid, pwd) {
	var self = this;
	//sequence for TCP requests
	self.seq = 0;
	//client status
	self.status = 'disconnected';
	//data types
	const types = MeianDataTypes();
  
	this.connect = function () {
		self.status = 'connecting';

		self.client = new net.Socket();
		self.client.setTimeout(30000);

		self.client.connect(port, host, function () {
			console.log('Connected to '+host+':'+port);
			self.login(uid, pwd);
		});
    
		self.client.on('data', function(data) {
			self._receive(data);
		});

		self.client.on('close', function() {
			console.log('Connection closed');
			self.status = 'disconnected';
			self.emit('disconnected', {host, port});
		});
	};
  
	/**
	 * Disconnect from TCP Alarm
	 */
	self.disconnect = function(){
		console.log('Closing connection...');
		if(self.client){
			self.status = 'disconnecting';
			self.client.destroy();
		}
	};

	/**
	 * Convert to XML the data, encrypt the message and send the request to TCP alarm
	 */
	this._send = function (data) {
		const xml = convert.js2xml(data, {compact: true, fullTagEmptyElement: true, spaces: 0});
		console.log('Requesting XML ' + xml);

		//incrementing sequence
		self.seq += 1;
		const msg = MeianMessage().createMessage(xml, self.seq, true);
		console.log('Requesting RAW ' + msg);

		//send data to socket
		self.client.write(msg);
	};

	/**
	 * Parse the TCP alarm response buffer
	 */
	this._receive = function (buffer) {
		var raw = String.fromCharCode.apply(null, buffer);
		console.log('Received RAW ' + raw);
		var xml = MeianMessage().extractMessage(raw);
		console.log('Received XML ' + xml);
		//cleanup <Err>ERR|00</Err> at root
		var Err = undefined;
		if(xml.indexOf('<Err>ERR') === 0){
			const error = xml.substring(0, xml.indexOf('</Err>')+6);
			xml = xml.replace(error, '');
			Err = convert.xml2js(error, {compact: true});
		}
		const data = convert.xml2js(xml, {compact: true});
		//apply <Err>ERR|00</Err> at root
		if(Err){
			data.Err = Err.Err._text;
		}
		console.log('Received data: ', data);
		//TODO check errors
		if(data.Err && data.Err !== 'ERR|00'){
			self.emit('error', data.Err);
		}else{
			var event = 'response';
			if(self.status === 'autenticating'){
				event = 'connected';
				self.status = event;
			}
			self.emit(event, data);
		}
	};


	/**
	 * Login
	 */
	this.login = function(uid, pwd){
		
		self.status = 'autenticating';

		var cmd = {};
		cmd.Id = types.STR(uid);
		cmd.Pwd = types.PWD(pwd);
		cmd.Type = 'TYP,ANDROID|0';
		cmd.Token = types.STR(function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		}());
		cmd.Action = 'TYP,IN|0';
		cmd.Err = null;
		//request
		const data = {Root: { Pair: {Client: cmd}}};
		self._send(data);
	};

	/**
	 * Get current alarm status
	 */
	this.getAlarmStatus = function(){
		var cmd = {};
		cmd['DevStatus'] = null;
		cmd['Err'] = null;
		//request
		var data = {Root: { Host: {GetAlarmStatus: cmd}}};
		self._send(data);
	};

}

util.inherits(MeianClient, EventEmitter);

module.exports = MeianClient;