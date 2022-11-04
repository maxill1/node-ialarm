
import MeianConstants from './meian-constants.js'
import MeianStatusDecoder from './meian-status-decoder.js'

const TYPES = /BOL|DTA|ERR|GBA|HMA|IPA|MAC|NEA|NUM|PWD|S32|STR|TYP/
const BOL = /BOL\|([FT])/
const DTA = /DTA(,\d+)*\|(\d{4}\.\d{2}.\d{2}.\d{2}.\d{2}.\d{2})/
const ERR = /ERR\|(\d{2})/
const GBA = /GBA,(\d+)\|([0-9A-F]*)/
const HMA = /HMA,(\d+)\|(\d{2}:\d{2})/
const IPA = /IPA,(\d+)\|(([0-2]?\d{0,2}\.){3}([0-2]?\d{0,2}))/
const MAC = /MAC,(\d+)\|(([0-9A-F]{2}[:-]){5}([0-9A-F]{2}))/
const NEA = /NEA,(\d+)\|([0-9A-F]+)/
const NUM = /NUM,(\d+),(\d+)\|(\d*)/
const PWD = /PWD,(\d+)\|(.*)/
const S32 = /S32,(\d+),(\d+)\|(\d*)/
const STR = /STR,(\d+)\|(.*)/
const TYP = /TYP,(\w+)\|(\d+)/

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
    [listName]: [],
    // raw data
    raw: list
  }

  list.forEach(current => {
    current = current || {}
    const linesTotal = MeianTCPResponseFormatter.cleanData(current.Ln?.value) || 0
    const offset = MeianTCPResponseFormatter.cleanData(current.Offset?.value) || 0

    for (let queryIndex = 0; queryIndex < linesTotal; queryIndex++) {
      // L0, L1, L2
      const lineKey = 'L' + queryIndex
      const element = current[lineKey]
      if (!element) {
        // L1, Lx may not exit on last call
        continue
      }
      const elementIndex = offset + queryIndex
      // index build using offset and L0,L1,L2
      element.index = elementIndex
      // extract L0, L1, etc and add them to the list in the container
      _listBasedFormatter(lineKey, element, container, listName, lineParser, true, linesTotal, offset)
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
const _listBasedFormatter = function (key, value, data, listName, rowFormatter, push, linesTotal, offset) {
  // L0, L1, etc
  const lineNumber = _getLineNumber(key)
  if (lineNumber !== null && rowFormatter) {
    const row = rowFormatter(value, key, lineNumber, linesTotal, offset)
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

const MeianTCPResponseFormatter = {

  /**
     * cleanup the response
     */
  cleanData: function (input) {
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
        value = new Date(Date.UTC(dta[0], dta[1], dta[2], dta[3], dta[4], dta[5]))
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

  GetAlarmStatus: function (data) {
    // console.log("Formatting GetAlarmStatus response");
    const status = data.DevStatus.value
    const exec = TYP.exec(status)
    return MeianStatusDecoder.fromTcpValueToStatus(exec[2])
  },

  SetAlarmStatus: function (data) {
    // console.log("Formatting GetAlarmStatus response");
    const status = data.DevStatus.value
    const exec = TYP.exec(status)
    return MeianStatusDecoder.fromTcpValueToStatus(exec[2])
  },

  /**
   * Alarm areas (used by Focus FC-7688Plus, not working in Meian ST-IVCGT)
   * @param {*} current
   * @param {*} container
   * @returns
   */
  GetArea: function (list) {
    const container = _parseListableData('areas', list, function (lineValue, key, lineNumber, lineTotal, offset) {
      const line = {}
      // if (!lineValue) {
      //   console.log('no lineValue')
      // }
      // line.queryNumber = lineNumber + '/' + lineTotal + '-' + offset + '('+key+')';
      line.id = (lineValue.index + 1) // base 1
      line.area = line.id
      line.status = MeianTCPResponseFormatter.cleanData(lineValue.Status.value)
      return line
    })
    return container
  },

  GetByWay: function (list) {
    // console.log("Formatting GetByWay response");

    const lastChecked = new Date()

    const container = _parseListableData('zones', list, function (lineValue, key, lineNumber, lineTotal, offset) {
      if (!lineValue || !lineValue.value) {
        console.log(JSON.stringify(lineValue))
        console.log(JSON.stringify(list))
      }
      const status = MeianTCPResponseFormatter.cleanData(lineValue.value)
      const normalizedIndex = lineValue.index

      const booleansAndMessage = MeianStatusDecoder.getZoneStatus(status)
      const zone = {
        lastChecked,
        id: normalizedIndex + 1,
        name: key,
        status,
        ...booleansAndMessage
      }

      return zone
    })

    return container
  },

  SetByWay: function (data) {
    return {
      zone: MeianTCPResponseFormatter.cleanData(data.Pos.value),
      bypass: MeianTCPResponseFormatter.cleanData(data.En.value) === 'T'
    }
  },

  /**
     * Get zone info
     */
  GetZone: function (list) {
    const container = _parseListableData('zones', list, function (lineValue, key, lineNumber, lineTotal, offset) {
      const line = {}
      // if (!lineValue) {
      //   console.log('no lineValue')
      // }
      // line.queryNumber = lineNumber + '/' + lineTotal + '-' + offset + '('+key+')';
      line.id = (lineValue.index + 1) // base 1
      line.zone = line.id
      line.name = MeianTCPResponseFormatter.cleanData(lineValue.Name.value)
      line.typeId = MeianTCPResponseFormatter.cleanData(lineValue.Type.value)
      line.type = MeianConstants.ZoneTypes[line.typeId]
      line.voiceId = MeianTCPResponseFormatter.cleanData(lineValue.Voice.value)
      line.voiceName = MeianConstants.ZoneVoices[line.voiceId]
      return line
    })
    return container
  },

  /**
     * List of events recorded in the alarm (arm, disarm, bypass, alert, etc)
     */
  GetLog: function (list) {
    // console.log("Formatting GetLog response");
    /*
        raw format
        "L1": { "Time": { "value": "DTA,19|2020.06.04.18.35.15" },
                "Area": { "value": "S32,1,40|16" },
                 "Event": { "value": "STR,4|1133" } }
        */
    /*
        scraper format
        date:"2020-11-25 21:28:09"
        message:"Zona Bypass"
        zone:"1" */
    const container = _parseListableData('logs', list, function (lineValue) {
      const line = {}
      line.date = MeianTCPResponseFormatter.cleanData(lineValue.Time.value)
      line.zone = MeianTCPResponseFormatter.cleanData(lineValue.Area.value)
      const event = MeianTCPResponseFormatter.cleanData(lineValue.Event.value)
      line.message = MeianConstants.cid[event] || event
      return line
    })

    return container
  },

  /**
     * Network config and alarm name
     * @param {*} data
     * @returns
     */
  GetNet: function (data) {
    // console.log("Formatting GetEvents response");
    const network = {}
    for (const key in data) {
      const element = data[key]
      const prop = key.toLowerCase()
      if (element.value) {
        const value = MeianTCPResponseFormatter.cleanData(element.value)
        network[prop] = value && value.trim && value.trim()
      } else {
        network[prop] = ''
      }
    }
    return network
  },

  /*
     * Not sure about what this means. They seem to be some CID decoded string
     */
  GetEvents: function (data) {
    // console.log("Formatting GetEvents response");
    const response = {
      events: [],
      raw: data
    }
    for (const key in data) {
      const element = data[key]
      if (element.value) {
        const value = MeianTCPResponseFormatter.cleanData(element.value)
        _listBasedFormatter(key, value, response, 'events', function (lineValue) {
          return MeianConstants.cid[lineValue]
        })
      }
    }
    return response
  },

  /*
  Push events like
  <Root>
    <Host>
      <Alarm>
        <Cid>STR,4|3441</Cid>
        <Content>STR,12|M. Partielle</Content>
        <Time>DTA|2018.09.02.01.12.01</Time>
        <Zone>S32,0,99|70</Zone>
        <ZoneName>STR,16|</ZoneName>
        <Name>STR,15|ORION IP2 </Name>
        <Err/>
      </Alarm>
    </Host>
  </Root>
  {
  "Root": {
      "Host": {
        "Alarm": {
          "Cid": {
            "value": "STR,4|3441"
          },
          "Content": {
            "value": "GBA,32|53697374656D61205061727A69616C65"
          },
          "Err": {},
          "Time": {
            "value": "DTA|2022.10.31.18.40.11"
          },
          "Zone": {
            "value": "S32,0,41|70"
          },
          "ZoneName": {
            "value": "GBA,16|"
          }
        }
      }
    }
  }
  */
  Alarm: function (data) {
    const event = data.Cid && MeianTCPResponseFormatter.cleanData(data.Cid.value)
    return {
      cid: MeianConstants.cid[event] || event,
      content: data.Content && MeianTCPResponseFormatter.cleanData(data.Content.value),
      time: data.Time && MeianTCPResponseFormatter.cleanData(data.Time.value),
      zone: data.Zone && MeianTCPResponseFormatter.cleanData(data.Zone.value),
      zoneName: data.ZoneName && MeianTCPResponseFormatter.cleanData(data.ZoneName.value),
      name: data.Name && MeianTCPResponseFormatter.cleanData(data.Name.value)

    }
  }

}

export default MeianTCPResponseFormatter
