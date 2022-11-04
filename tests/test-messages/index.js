
import fs from 'fs'
import path from 'path'
import { MeianMessage } from '../ialarm'

const baseDir = path.join(__dirname, './')

function hex2a (hexx) {
  const hex = hexx.toString()// force conversion
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    const part = hex.substr(i, 2)
    const char = String.fromCharCode(parseInt(part, 16))
    str += char
  }
  return str
}

fs.readFile(`${baseDir}/message.txt`, 'utf8', (err, fileData) => {
  if (err) {
    console.error(err)
    return
  }

  // cleanup parts before @ieM
  const hex = fileData.substring(fileData.indexOf('\\x40\\x69\\x65\\x4d')).split(/["]/).join('')
    // removing wireshark " \"
    .split(/ \\/).join('')
    // removing wireshark "\n"
    .split(/\n/).join('')
    // removing \\x to make it a parsable ascii hex
    .split(/[\\x]/).join('')

  const message = hex2a(hex)
  const xml = MeianMessage.extractMessage(message)
  console.log('Decoded message ' + xml)
})
