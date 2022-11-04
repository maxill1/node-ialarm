import { MeianMessage /* MeianTCPResponseFormatter */ } from '../index.js'
import testdata from './testdata'

// MeianClient()._send(testdata.INIT.json)
// MeianClient()._receive(testdata.INIT.raw)
// MeianTCPResponseFormatter.GetByWay(testdata.GetByWay.Root.Host.GetByWay)

// const tcpMessage = MeianMessage.createMessage(testdata.INIT.xml)
// console.log('Created message ' + tcpMessage)
// const xml = MeianMessage.extractMessage(tcpMessage)
// console.log('Decoded message ' + xml)

const message = testdata.STATUS.raw
// cleanup parts before @ieM
const xml = MeianMessage.extractMessage(message)
console.log('Decoded message ' + xml)
