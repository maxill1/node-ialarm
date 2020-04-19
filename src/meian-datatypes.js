
module.exports = function MeianDataTypes () {
	var self = this;

	self.BOL = function (en) {
		if (en) {
			return 'BOL|T';
		}
		return 'BOL|F';
	};

	self.DTA = function (date) {
		var dta = `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`;
		var size = dta.length;
		return `DTA,${size}|${dta}`;
	};

	self.type = function(name, input){
		var size = input.length;
		return `${name},${size}|${input}`;
	};

	self.PWD = function(pwd){
		return self.type('PWD', pwd);
	};

	self.S32 = function(val, pos = 0){
		return `S32,${pos},${pos}|${val}`;
	};

	self.MAC = function(mac){
		return self.type('MAC', mac);
	};

	self.IPA = function(ip){
		return self.type('IPA', ip);
	};

	self.STR = function(text){
		return self.type('STR', text);
	};

	return self;
};

/*



self.TYP = function(val, typ = []){
try:
    return 'TYP,%s|%d' % (typ[val], val)
except IndexError:
    return 'TYP,NONE,|%d' % val
}
    */
