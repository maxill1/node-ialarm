import convert from 'xml-js'

const type = function (name, input) {
  const size = input.length
  return `${name},${size}|${input}`
}

export const MeianDataTypes = {
  BOL: function (en) {
    if (en) {
      return 'BOL|T'
    }
    return 'BOL|F'
  },
  DTA: function (date) {
    const dta = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`
    const size = dta.length
    return `DTA,${size}|${dta}`
  },
  PWD: function (pwd) {
    return type('PWD', pwd)
  },
  S32: function (val, pos = 0, max) {
    if (!max) {
      max = pos
    }
    return `S32,${pos},${max}|${val}`
  },
  IPA: function (ip) {
    return type('IPA', ip)
  },
  STR: function (text) {
    return type('STR', text)
  },
  TYP: function (val, typ = []) {
    try {
      const t = typ[val]
      return `TYP,${t}|${val}`
    } catch (error) {
      return `TYP,NONE,|${val}` % val
    }
  }
}

/**
 * 128 bytes key as byte array
 */
const KEY = ((hexString) => {
  const result = []
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substr(i, 2), 16))
  }
  return result
})('0c384e4e62382d620e384e4e44382d300f382b382b0c5a6234384e304e4c372b10535a0c20432d171142444e58422c421157322a204036172056446262382b5f0c384e4e62382d620e385858082e232c0f382b382b0c5a62343830304e2e362b10545a0c3e432e1711384e625824371c1157324220402c17204c444e624c2e12')

const toString = function (bytes) {
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}

const getBytes = function (str) {
  const bytes = str.split('').map(function s (x) { return x.charCodeAt(0) })
  return bytes
}

/**
   * XOR encrypted/decrypted message with a 128 bytes key
   */
const decryptEncrypt = function (message) {
  const bytes = getBytes(message)
  // var str = toString(buf)
  // console.log(str)
  for (let i = 0; i < bytes.length; i++) {
    const ki = i & 0x7f
    bytes[i] = bytes[i] ^ KEY[ki]
  }
  return bytes
}

/**
 * Meian Message builder/parse based on this specs:
 * https://github.com/wildstray/meian-client/wiki
 */

export const MeianMessage = {
  /**
     * Encrypt and build a message
     */
  createMessage: function (xml, sequence, isRequest) {
    if (!sequence) {
      sequence = 1
    }
    const encryptedMessageBytes = decryptEncrypt(xml)
    const encryptedMessage = toString(encryptedMessageBytes)
    const msgType = '@ieM' // First 4 bytes is the message type: There are three message types: 1) get/set ('@ieM') 2) push ('@alA') 3) keepalive ('%maI').
    const msgSize = ('000' + encryptedMessageBytes.length).slice(-4) // next four bytes are size of encrypted data
    const msgSeq = ('000' + sequence).slice(-4) // next four bytes are a sequence number
    const msgFiller = '0000' // next four bytes are always zeroes then there is an encrypted request or response.;
    const msgEnding = !isRequest ? msgSize : '0000' // Last four bytes are size of encrypted data for request, 0000 or -001 for response
    const msg = `${msgType}${msgSize}${msgSeq}${msgFiller}${encryptedMessage}${msgEnding}`
    return msg
  },

  /**
     * Encrypt and build a message
     */
  extractMessage: function (data) {
    // remove head (msg type, size and filler) and tail (msg size or -0001)
    const encryptedMessage = data.substring(0, data.length - 4).substring(16)
    const decryptedMessageBytes = decryptEncrypt(encryptedMessage)
    const message = toString(decryptedMessageBytes)
    return message
  },
  toXml: function (cmd, rootPath) {
    // eventually adds /Root/Host/CommandName
    let data = {}
    if (rootPath) {
      const paths = rootPath.split('/')
      let lastIteratedObj = data
      for (let i = 1; i < paths.length; i++) {
        const key = paths[i]
        lastIteratedObj[key] = {}
        if (i === paths.length - 1) {
          lastIteratedObj[key] = cmd
        }
        lastIteratedObj = lastIteratedObj[key]
      }
    } else {
      data = cmd
    }
    const xml = convert.js2xml(data, { compact: true, fullTagEmptyElement: true, spaces: 0, textKey: 'value' })
    return xml
  },
  toJson: function (xml) {
    // cleanup <Err>ERR|00</Err> at root
    let Err
    if (xml.indexOf('<Err>ERR') === 0) {
      const error = xml.substring(0, xml.indexOf('</Err>') + 6)
      xml = xml.replace(error, '')
      Err = convert.xml2js(error, { compact: true, textKey: 'value' })
    }
    const data = convert.xml2js(xml, { compact: true, textKey: 'value' })
    // apply <Err>ERR|00</Err> at root
    if (Err) {
      data.Err = Err.Err.value
    }
    return data
  },
  /**
   * Convert to XML the data, encrypt the message
   */
  prepareMessage: function (root, cmd, sequence) {
    const xml = MeianMessage.toXml(cmd, root)
    // console.log('Requesting XML ' + xml);

    const msg = MeianMessage.createMessage(xml, sequence || 1, true)
    // console.log('Requesting RAW ' + msg);

    return msg
  }

}

export const TYPES = /BOL|DTA|ERR|GBA|HMA|IPA|MAC|NEA|NUM|PWD|S32|STR|TYP/
export const BOL = /BOL\|([FT])/
export const DTA = /DTA(,\d+)*\|(\d{4}\.\d{2}.\d{2}.\d{2}.\d{2}.\d{2})/
export const ERR = /ERR\|(\d{2})/
export const GBA = /GBA,(\d+)\|([0-9A-F]*)/
export const HMA = /HMA,(\d+)\|(\d{2}:\d{2})/
export const IPA = /IPA,(\d+)\|(([0-2]?\d{0,2}\.){3}([0-2]?\d{0,2}))/
export const MAC = /MAC,(\d+)\|(([0-9A-F]{2}[:-]){5}([0-9A-F]{2}))/
export const NEA = /NEA,(\d+)\|([0-9A-F]+)/
export const NUM = /NUM,(\d+),(\d+)\|(\d*)/
export const PWD = /PWD,(\d+)\|(.*)/
export const S32 = /S32,(\d+),(\d+)\|(\d*)/
export const STR = /STR,(\d+)\|(.*)/
export const TYP = /TYP,(\w+)\|(\d+)/

const getHostData = function (response, hostType) {
  const content = response?.Root?.Host || {}
  const commandName = Object.keys(content)[0]
  return content[commandName]
}

const getPairData = function (response, hostType) {
  const content = response?.Root?.Pair || {}
  const commandName = Object.keys(content)[0]
  return content[commandName]
}

/**
   * get index from a line node (L0, L1, L2, L3, etc)
   * @param {*} key
   */
const _getLineNumber = function (key) {
  const regRows = key.match(/L(\d{1,2})/)
  if (regRows && regRows.length > 0) {
    const index = parseInt(regRows[1])
    if (!isNaN(index)) {
      return index
    }
  }
  return null
}

/**
   * When multiple messages are neede to get a full list, this function will handle the parsing and push
   */
const _parseListableData = function (listName, list, lineParser) {
  if (!Array.isArray(list)) {
    list = [list]
  }

  const container = {
    // current formatted list
    [listName]: []
  }

  list.forEach(root => {
    const current = getHostData(root) || {}
    const linesTotal = MeianMessageCleaner.cleanData(current.Ln?.value) || 0
    const offset = MeianMessageCleaner.cleanData(current.Offset?.value) || 0

    for (let queryIndex = 0; queryIndex < linesTotal; queryIndex++) {
      // L0, L1, L2
      const lineKey = 'L' + queryIndex
      const element = current[lineKey]
      if (!element) {
        // L1, Lx may not exit on last call
        continue
      }
      const elementIndex = offset + queryIndex

      // extract L0, L1, etc and add them to the list in the container
      _listBasedFormatter(lineKey, element, container, listName, lineParser, true, linesTotal, offset,
        elementIndex) // index build using offset and L0,L1,L2
    }
  })

  // formatted data
  return container
}

/**
   * parses a line based response
   * @param {*} key current iterated key
   * @param {*} element xml element value
   * @param {*} data the response object
   * @param {*} listName the name of the list containing lines (events, logs, etc)
   */
const _listBasedFormatter = function (key, value, data, listName, rowFormatter, push, linesTotal, offset, elementIndex) {
  // L0, L1, etc
  const lineNumber = _getLineNumber(key)
  if (lineNumber !== null && rowFormatter) {
    const row = rowFormatter(value, key, lineNumber, linesTotal, offset, elementIndex)
    if (!data[listName]) {
      data[listName] = []
    }
    if (push) {
      data[listName].push(row)
    } else {
      data[listName][lineNumber] = row
    }
  }
}

export const MeianMessageCleaner = {

  /**
     * cleanup the response
     */
  cleanData: function (input) {
    if (!input) {
      return
    }
    let value = input
    const type = TYPES.exec(input) && TYPES.exec(input)[0]
    // if (!type) {
    //   console.log(`No type found for ${input}`)
    // }

    switch (type) {
      case 'BOL': {
        const bol = BOL.exec(input)[1]
        if (bol === 'T') {
          value = true
        }
        if (bol === 'F') {
          value = false
        }
        break
      }
      case 'DTA': {
        // 2020.06.04.18.40.03
        const dta = DTA.exec(input)[2].split('.')
        value = new Date(Date.UTC(dta[0], parseInt(dta[1]) - 1, dta[2], dta[3], dta[4], dta[5])).toISOString()
        break
      }
      case 'ERR':
        value = parseInt(ERR.exec(input)[0])
        break
      case 'GBA': {
        const bytes = GBA.exec(input)[2]
        const hexTooAscii = function (str1) {
          const hex = str1.toString()
          let str = ''
          for (let n = 0; n < hex.length; n += 2) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16))
          }
          return str
        }
        value = hexTooAscii(bytes)
        break
      }
      case 'HMA': {
        // 00:00
        const hma = HMA.exec(input)[2]
        value = hma
        // value = time.strptime(hma, '%H:%M')
        break
      }
      case 'IPA':
        // IPA,16|192.168.1.81
        value = String(IPA.exec(input)[2])
        break
      case 'MAC':
        // MAC,17|00:00:xx:xx:xx:xx
        value = String(MAC.exec(input)[2])
        break
      case 'NEA':
        value = String(NEA.exec(input)[2])
        break
      case 'NUM':
        value = String(NUM.exec(input)[2])
        break
      case 'PWD':
        value = String(PWD.exec(input)[2])
        break
      case 'S32':
        value = parseInt(S32.exec(input)[3])
        break
      case 'STR':
        value = String(STR.exec(input)[2])
        break
      case 'TYP':
        value = parseInt(TYP.exec(input)[2])
        break
      default:
        // console.log(`No type found for ${input}`)
        break
    }

    if (value && value.trim) {
      value = value.trim()
    }

    return value
  },

  parseData: function (response, parser, listName, hostType) {
    if (!Array.isArray(response)) {
      response = [response]
    }

    let first = getHostData(response[0], hostType)
    if (!first) {
      first = getPairData(response[0], hostType)
    }
    const linesTotal = MeianMessageCleaner.cleanData(first.Ln?.value) || 0
    // list
    if (linesTotal > 0) {
      return _parseListableData(listName || 'list', response, parser)
    } else if (parser) {
      // single command
      return parser(first)
    } else {
      return first
    }
  },

  default: function (response) {
    return MeianMessageCleaner.parseData(response)
  }

}
