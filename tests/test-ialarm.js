
const MeianClient = require('../ialarm')

const args = {}
process.argv.slice(2).forEach(function (val) {
  if (val.indexOf('=') > -1) {
    const a = val.split('=')
    args[a[0]] = a[1]
  }
})

// TEST
const host = args.host || '192.168.1.81'
const port = args.port || 18034
const username = args.username
const password = args.password
const logLevel = args.logLevel
// var zones = args['zones']?JSON.parse(args['zones']):undefined;

if (!username || !password) {
  console.log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword')
} else {
  console.log('will test meianClient on ' + host + ':' + port)

  async function testLibrary (functionName, arg1, arg2) {
    const alarm = new MeianClient(host, port, username, password, undefined, logLevel, 2500)
    try {
      const response = await alarm[functionName](arg1, arg2)
      console.log('response: ' + JSON.stringify(response))
    } catch (error) {
      console.log('Error: ', error)
    }
  }
  // implemented
  // testLibrary('getNet')
  // testLibrary('getLastEvents')
  // testLibrary('getEvents')
  testLibrary('getStatusAlarm')
  // testLibrary('getStatusArea')
  // testLibrary('getZoneStatus')
  // testLibrary('getFullStatus')
  // testLibrary('getZoneInfo')
  // testLibrary('getZoneInfo', 14)
  // testLibrary('bypassZone', 2, true)
  // testLibrary('bypassZone', 2, false)
  // testLibrary('armAway')
  // testLibrary('armHome')
  // testLibrary('armHome', 3)
  // testLibrary('disarm');
  // testLibrary('cancel');
}
