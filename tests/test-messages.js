
const testdata = require('./testdata')
// const formatters = require('../src/tcp-response-formatters')()
// MeianClient()._send(testdata.INIT.json)
// MeianClient()._receive(testdata.INIT.raw)
// formatters.GetByWay(testdata.GetByWay.Root.Host.GetByWay)

const { MeianMessage } = require('../src/meian-message')
const messageHandler = MeianMessage()

// const tcpMessage = messageHandler.createMessage(testdata.INIT.xml)
// console.log('Created message ' + tcpMessage)
// const xml = messageHandler.extractMessage(tcpMessage)
// console.log('Decoded message ' + xml)

const message = testdata.STATUS.raw
// cleanup parts before @ieM
const xml = messageHandler.extractMessage(message)
console.log('Decoded message ' + xml)
