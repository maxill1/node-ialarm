
import { MeianStatusDecoder, MeianClient } from '../index.js'

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

if (!username || !password) {
  console.log('Please provide a valid username and password: node ialarm-test username=myuser password=mypassword')
} else {
  console.log('will test meianClient on ' + host + ':' + port)

  function testSocket (commands, commandsArgs, callback) {
    console.log(`Sending command: ${commands} with args ${commandsArgs}`)
    MeianClient(host, port, username, password).executeCommand(commands, commandsArgs).then(function (data) {
      console.log(`Response: ${JSON.stringify(data)}`)
      if (callback) {
        callback()
      }
    }, function (err) {
      console.error('Error:', err)
    }).catch(err => console.error('Fatal:', err))
  }
  // testSocket(['GetNet'])
  // testSocket(['GetZone'])
  // testSocket(['GetByWay'])
  // testSocket(['SetByWay'], [[0, true]])
  // testSocket(['GetArea'], [[0]])
  // testSocket(['GetArea', 'GetArea', 'GetArea', 'GetArea'], [[0], [1], [2], [3]])
  testSocket(['SetArea'], [[0, MeianStatusDecoder.fromStatusToTcpValue('ARMED_HOME')]], function () {
    setTimeout(() => {
      testSocket(['GetArea'], [[0]], function () {
        setTimeout(() => {
          testSocket(['GetArea'], [[1]], function () {
            setTimeout(() => {
              testSocket(['GetArea'], [[2]], function () {
                setTimeout(() => {
                  testSocket(['GetArea'], [[3]])
                }, 5000)
              })
            }, 5000)
          })
        }, 5000)
      })
    }, 5000)
  })
// testSocket(['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone'])
}
