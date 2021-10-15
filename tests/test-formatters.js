
const testdata = require('./testdata')
const formatters = require('../src/tcp-response-formatters')()
// MeianClient()._send(testdata.INIT.json)
// MeianClient()._receive(testdata.INIT.raw)
console.log(formatters.GetArea(testdata.GetArea.Root.Host.GetArea, {}))
