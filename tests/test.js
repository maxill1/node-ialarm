import { describe, expect, /* beforeAll, afterAll, beforeEach, */it, jest } from '@jest/globals'
import { MeianCommands, MeianMessage, MeianMessageCleaner, MeianStatusDecoder } from '../index.js'
import TestSocket from './test-utils.js'
import testdata from './test-dump.json'

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
const dump = args.dump
const push = args.push

function testMessages (command) {
  it(`${command} - should read, convert and parse messages`, () => {
    console.log(`Testing command ${command}`)
    const compare = testdata[command]

    expect(compare).toBeDefined()

    if (compare) {
      const encrypted = MeianMessage.createMessage(compare.xml, 1, true)
      expect(encrypted).toBe(compare.encrypted)

      // from raw message to xml
      const xml = MeianMessage.extractMessage(compare.encrypted)
      expect(xml).toBe(compare.xml)

      // from xml to json
      const rawData = MeianMessage.toJson(xml)
      expect(rawData).toEqual(compare.rawData)

      // formatted
      const formatted = ((MeianCommands[command] && MeianCommands[command].formatter) || MeianMessageCleaner.default)(rawData)
      expect(formatted).toEqual(compare.data)

      // generate again an xml and convert it to raw data
      const xmlGenerated = MeianMessage.toXml(
        {
          // needed to remove <Err>ERR|00</Err> if present
          Root: compare.rawData.Root
        }
      )
      // than json
      const rawDataBis = MeianMessage.toJson(xmlGenerated)
      // expect to not lose any data
      expect(rawDataBis).toEqual({
        // needed to remove <Err>ERR|00</Err>
        Root: rawData.Root
      })

      console.log(`Tested command "${command}" done`)
    }
  })
}

function testMeianSocket (commandsNames, commandArgs, dumpResponses, push) {
  it(`MeianSocket ${commandsNames} (${commandArgs})`, async () => {
    const status = await TestSocket(host, port, username, password, zones, [
      {
        command: commandsNames,
        args: commandArgs
      }
    ],
    push,
    dumpResponses)

    if (push) {
      expect(status).toMatch(/push/)
    } else {
      let compare = commandsNames
      if (!Array.isArray(commandsNames)) {
        compare = [commandsNames]
      }
      expect(status).toEqual(compare)
    }
  })
}

jest.setTimeout(30000)

describe('Meian client tests', () => {
  describe('Testing MeianMessageCleaner and MeianMessage', () => {
    testMessages('GetArea')
    testMessages('Client')
    testMessages('GetAlarmStatus')
    testMessages('GetByWay')
    testMessages('GetLog')
    testMessages('GetZone')
  })

  if (username && password) {
    if (push) {
      describe('Testing Client and responses and leaving connection open for "Push" test', () => {
        testMeianSocket(['GetAlarmStatus', 'SetByWay'], [[], [[0, true]]], false, true)
      })
    } else {
      describe('Testing Client and responses', () => {
        testMeianSocket('GetNet')
        testMeianSocket('GetAlarmStatus')
        testMeianSocket('GetZone')
        testMeianSocket('GetLog')
        testMeianSocket('GetByWay')
        testMeianSocket(['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone'])

        // setter
        // testMeianSocket('SetAlarmStatus', [[MeianStatusDecoder.fromStatusToTcpValue('ARMED_HOME')]])
        // testMeianSocket('SetByWay', [[2, false]])
        // testMeianSocket('SetAlarmStatus', [[MeianStatusDecoder.fromStatusToTcpValue('DISARMED')]])

        // area
        // testMeianSocket('GetArea') //can't test it personally
        // testMeianSocket('GetArea', [[0, true]]) //can't test it personally
        // testMeianSocket('SetArea', [[0, MeianStatusDecoder.fromStatusToTcpValue('ARMED_HOME')]]) //can't test it personally
        // testMeianSocket('SetArea', [[0, MeianStatusDecoder.fromStatusToTcpValue('DISARMED')]]) //can't test it personally

        // TODO commands not implemented/tested/formatted yet
        // GetPhone();
        // GetWlsList()
        // GetWlsStatus(15);
        // GetSensor();
        // GetEvents();
        // GetSensor();
        // GetZoneType();
        // GetDefense();
        // WlsStudy();
        // ConfigWlWaring();
        // FskStudy(true);
        // GetWlsStatus(0);
        // GetWlsList();
        // SwScan();
        // GetSwitch();
        // SetSwitchInfo(0, 'Switch0', '01:23', '12:34');
        // GetSwitchInfo();
        // OpSwitch(0, false);
        // GetByWay();
        // GetDefense();
        // GetEmail();
        // GetEvents();
        // GetGprs(1100);
        // GetNet();
        // GetOverlapZone();
        // GetPairServ();
        // GetPhone();
        // GetRemote();
        // GetRfid();
        // GetRfidType();
        // GetSendby(1100);
        // GetSensor();
        // GetServ();
        // GetSwitch();
        // GetSwitchInfo();
        // GetSys();
        // GetTel();
        // GetTime();
        // GetVoiceType();
        // GetZoneType();
        // OpSwitch(0, false);
        // OpSwitch(0, true);
        // OpSwitch(1, false);
        // OpSwitch(1, true);
        // Reset(0);
      })
    }

    if (dump) {
      describe('Dumping Responses to test-dump.json', () => {
        testMeianSocket(['GetAlarmStatus', 'GetByWay', 'GetLog', 'GetZone'], [[], [0], [0], [0]], dump)
      })
    }
  }
})
