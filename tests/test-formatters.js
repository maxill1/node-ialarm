
import { MeianTCPResponseFormatter } from '../index.js'
import testdata from './testdata'

// MeianClient()._send(testdata.INIT.json)
// MeianClient()._receive(testdata.INIT.raw)
console.log(MeianTCPResponseFormatter.GetArea(testdata.GetArea.Root.Host.GetArea, {}))
