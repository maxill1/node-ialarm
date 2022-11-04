import TestSocket from './test-utils.js'

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
const zones = args.zones

// test all
TestSocket(host, port, username, password, zones, [
  /* {
    command: 'GetNet'
  }, */
  {
    command: 'GetAlarmStatus'
  } /*
  {
    command: 'GetZone'
  },
  {
    command: 'GetByWay'
  },
  // this will produce also an "Alarm" response
  {
    command: 'SetByWay',
    args: [[0, true]]
  },
  {
    command: 'GetByWay'
  } */
],
// hold connection open to receive push
60000
)
