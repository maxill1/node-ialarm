
/**
 * Meian Message builder/parse based on this specs:
 * https://github.com/wildstray/meian-client/wiki
 */
module.exports = function MeianMessage () {
	var self = this;

	/**
       * 128 bytes key as byte array
       */
	const KEY = ((hexString) => {
		var result = [];
		for (var i = 0; i < hexString.length; i += 2) {
			result.push(parseInt(hexString.substr(i, 2), 16));
		}
		return result;
	})('0c384e4e62382d620e384e4e44382d300f382b382b0c5a6234384e304e4c372b10535a0c20432d171142444e58422c421157322a204036172056446262382b5f0c384e4e62382d620e385858082e232c0f382b382b0c5a62343830304e2e362b10545a0c3e432e1711384e625824371c1157324220402c17204c444e624c2e12');

	var toString = function (bytes) {
		var str = '';
		for (var i = 0; i < bytes.length; i++) {
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	};

	var getBytes = function (str) {
		var bytes = str.split('').map(function s (x) { return x.charCodeAt(0); });
		return bytes;
	};

	/**
     * XOR encrypted/decrypted message with a 128 bytes key
     */
	var decryptEncrypt = function (message) {
		var bytes = getBytes(message);
		// var str = toString(buf)
		// console.log(str)
		for (let i = 0; i < bytes.length; i++) {
			const ki = i & 0x7f;
			bytes[i] = bytes[i] ^ KEY[ki];
		}
		return bytes;
	};

	/**
     * Encrypt and build a message
     */
	self.createMessage = function (xml, sequence, isRequest) {
		if (!sequence) {
			sequence = 1;
		}
		var encryptedMessageBytes = decryptEncrypt(xml);
		var encryptedMessage = toString(encryptedMessageBytes);
		var msgType = '@ieM'; // First 4 bytes is the message type: There are three message types: 1) get/set ('@ieM') 2) push ('@alA') 3) keepalive ('%maI').
		var msgSize = ('000' + encryptedMessageBytes.length).slice(-4); // next four bytes are size of encrypted data
		var msgSeq = ('000' + sequence).slice(-4); // next four bytes are a sequence number
		var msgFiller = '0000'; // next four bytes are always zeroes then there is an encrypted request or response.;
		var msgEnding = !isRequest ? msgSize : '0000'; // Last four bytes are size of encrypted data for request, 0000 or -001 for response
		var msg = `${msgType}${msgSize}${msgSeq}${msgFiller}${encryptedMessage}${msgEnding}`;
		return msg;
	};

	/**
     * Encrypt and build a message
     */
	self.extractMessage = function (data) {
		// remove head (msg type, size and filler) and tail (msg size or -0001)
		var encryptedMessage = data.substring(0, data.length - 4).substring(16);
		var decryptedMessageBytes = decryptEncrypt(encryptedMessage);
		var message = toString(decryptedMessageBytes);
		return message;
	};

	return self;
};
