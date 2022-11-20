import { describe, expect, /* beforeAll, afterAll, beforeEach, */it, jest } from '@jest/globals'
import { MeianCommands, MeianMessage, MeianMessageCleaner, MeianDataHandler } from '../index.js'
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

function testMessages (command, isResponse) {
  it(`${command} - should read, convert and parse messages`, () => {
    console.log(`Testing command ${command}`)
    const compare = testdata[command]

    expect(compare).toBeDefined()

    if (compare) {
      const encrypted = MeianMessage.createMessage(compare.xml, 1, !isResponse)
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

function generateFakeData (command, isResponse, fromXml) {
  it(`${command} - should parse messages`, () => {
    console.log(`Testing command ${command}`)
    const compare = testdata[command]

    expect(compare).toBeDefined()

    if (compare) {
      const data = {
        encrypted: '',
        xml: '',
        data: {},
        rawData: {}
      }

      if (fromXml) {
        data.xml = compare.xml
        data.rawData = MeianMessage.toJson(data.xml)
      } else {
        // json
        data.rawData = compare.rawData
        data.xml = MeianMessage.toXml(
          {
            // needed to remove <Err>ERR|00</Err> if present
            Root: data.rawData.Root
          }
        )
      }
      data.encrypted = MeianMessage.createMessage(data.xml, 1, !isResponse)
      data.formatted = ((MeianCommands[command] && MeianCommands[command].formatter) || MeianMessageCleaner.default)(data.rawData)

      console.log(`generated "${JSON.stringify(data)}"`)
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

function testMeianDataHandler (functionName, desctiption, data, dataExpected, propertyToCheck) {
  it(`MeianDataHandler ${functionName} - ${desctiption} - (${JSON.stringify(data)})`, async () => {
    const funct = MeianDataHandler[functionName]
    expect(funct).toBeDefined()

    const [arg1, arg2, arg3, arg4] = Array.isArray(data) ? data : [data]

    const compare = funct(arg1, arg2, arg3, arg4)

    expect(propertyToCheck ? dataExpected[propertyToCheck] : dataExpected).toEqual(propertyToCheck ? compare[propertyToCheck] : compare)
  })
}

jest.setTimeout(30000)

describe('Meian client tests', () => {
  describe('Testing MeianMessageCleaner and MeianMessage', () => {
    testMessages('GetArea')
    testMessages('SetArea', true)
    testMessages('Client')
    testMessages('GetAlarmStatus')
    testMessages('SetAlarmStatus', true)
    testMessages('GetByWay')
    testMessages('GetLog')
    testMessages('GetZone')
  })

  /* describe('Generate test data for MeianCommand responses', () => {
    generateFakeData('SetAlarmStatus', true, true)
  }) */

  describe('Testing MeianDataHandler', () => {
    const GetAlarmStatusArmedHome = {
      status: 'ARMED_HOME'
    }
    const GetAlarmStatusDisarmed = {
      status: 'DISARMED'
    }
    const GetAreaArmedHome = { areas: [{ area: 1, id: 1, status: 'ARMED_HOME', value: 2 }, { area: 2, id: 2, value: 1, status: 'DISARMED' }, { area: 3, id: 3, value: 1, status: 'DISARMED' }, { area: 4, id: 4, value: 1, status: 'DISARMED' }] }
    const GetAreaDisarmed = { areas: [{ area: 1, id: 1, status: 'DISARMED', value: 2 }, { area: 2, id: 2, value: 1, status: 'DISARMED' }, { area: 3, id: 3, value: 1, status: 'DISARMED' }, { area: 4, id: 4, value: 1, status: 'DISARMED' }] }

    const GetByWay = {
      zones: [
        {
          id: 1,
          name: 'L0',
          status: 1,
          inUse: true,
          ok: true,
          alarm: false,
          bypass: false,
          lowbat: false,
          fault: false,
          wirelessLoss: false,
          problem: false,
          message: 'OK'
        },
        {
          id: 2,
          name: 'L1',
          status: 1,
          inUse: true,
          ok: true,
          alarm: false,
          bypass: false,
          lowbat: false,
          fault: false,
          wirelessLoss: false,
          problem: false,
          message: 'OK'
        },
        {
          id: 3,
          name: 'L2',
          status: 1,
          inUse: true,
          ok: true,
          alarm: false,
          bypass: false,
          lowbat: false,
          fault: false,
          wirelessLoss: false,
          problem: false,
          message: 'OK'
        },
        {
          id: 4,
          name: 'L4',
          status: 1,
          inUse: true,
          ok: true,
          alarm: false,
          bypass: false,
          lowbat: false,
          fault: false,
          wirelessLoss: false,
          problem: false,
          message: 'OK'
        },
        {
          id: 5,
          name: 'L5',
          status: 1,
          inUse: true,
          ok: true,
          alarm: false,
          bypass: false,
          lowbat: false,
          fault: false,
          wirelessLoss: false,
          problem: false,
          message: 'OK'
        }
      ]
    }

    const GetZone = {
      zones: [
        {
          id: 1,
          zone: 1,
          name: 'Zone 1',
          typeId: 1,
          type: 'Ritardata',
          voiceId: 1,
          voiceName: 'Fisso'
        },
        {
          id: 2,
          zone: 2,
          name: 'Zone 2',
          typeId: 2,
          type: 'Perimetrale',
          voiceId: 1,
          voiceName: 'Fisso'
        },
        {
          id: 3,
          zone: 3,
          name: 'Zone 3',
          typeId: 2,
          type: 'Perimetrale',
          voiceId: 1,
          voiceName: 'Fisso'
        },
        {
          id: 4,
          zone: 4,
          name: 'Zone 4',
          typeId: 2,
          type: 'Perimetrale',
          voiceId: 1,
          voiceName: 'Fisso'
        },
        {
          id: 5,
          zone: 5,
          name: 'Zone 5',
          typeId: 2,
          type: 'Perimetrale',
          voiceId: 1,
          voiceName: 'Fisso'
        }
      ]
    }

    const MERGED_ZONES = [
      {
        id: 1,
        name: 'Zone 1',
        status: 1,
        inUse: true,
        ok: true,
        alarm: false,
        bypass: false,
        lowbat: false,
        fault: false,
        wirelessLoss: false,
        problem: false,
        message: 'OK',
        zone: 1,
        typeId: 1,
        type: 'Ritardata',
        voiceId: 1,
        voiceName: 'Fisso'
      },
      {
        id: 2,
        name: 'Zone 2',
        status: 1,
        inUse: true,
        ok: true,
        alarm: false,
        bypass: false,
        lowbat: false,
        fault: false,
        wirelessLoss: false,
        problem: false,
        message: 'OK',
        zone: 2,
        typeId: 2,
        type: 'Perimetrale',
        voiceId: 1,
        voiceName: 'Fisso'
      },
      {
        id: 3,
        name: 'Zone 3',
        status: 1,
        inUse: true,
        ok: true,
        alarm: false,
        bypass: false,
        lowbat: false,
        fault: false,
        wirelessLoss: false,
        problem: false,
        message: 'OK',
        zone: 3,
        typeId: 2,
        type: 'Perimetrale',
        voiceId: 1,
        voiceName: 'Fisso'
      },
      {
        id: 4,
        name: 'Zone 4',
        status: 1,
        inUse: true,
        ok: true,
        alarm: false,
        bypass: false,
        lowbat: false,
        fault: false,
        wirelessLoss: false,
        problem: false,
        message: 'OK',
        zone: 4,
        typeId: 2,
        type: 'Perimetrale',
        voiceId: 1,
        voiceName: 'Fisso'
      },
      {
        id: 5,
        name: 'Zone 5',
        status: 1,
        inUse: true,
        ok: true,
        alarm: false,
        bypass: false,
        lowbat: false,
        fault: false,
        wirelessLoss: false,
        problem: false,
        message: 'OK',
        zone: 5,
        typeId: 2,
        type: 'Perimetrale',
        voiceId: 1,
        voiceName: 'Fisso'
      }
    ]

    const zonesToQuery = [1, 2, 3]

    // testing triggers
    const GetByWayTriggered = {
      zones: ((zones) => {
        zones[1] = {
          ...zones[1],
          alarm: true // triggered
        }
        return zones
      })([...GetByWay.zones])
    }

    const GetZoneH24 = {
      zones: ((zones) => {
        zones[1] = {
          ...zones[1],
          typeId: 5, // H24
          type: 'FakeH24'
        }
        return zones
      })([...GetZone.zones])
    }

    // GetAlarmStatus
    testMeianDataHandler('getStatus',
      'GetAlarmStatus disarmed status as string',
      'DISARMED',
      {
        status_1: 'DISARMED',
        status_2: 'UNKNOWN',
        status_3: 'UNKNOWN',
        status_4: 'UNKNOWN'
      })
    // GetAlarmStatus.status
    testMeianDataHandler('getStatus',
      'GetAlarmStatus armed status',
      GetAlarmStatusArmedHome,
      {
        status_1: 'ARMED_HOME',
        status_2: 'UNKNOWN',
        status_3: 'UNKNOWN',
        status_4: 'UNKNOWN'
      })
    testMeianDataHandler('getStatus',
      'GetAlarmStatus disarmed status',
      GetAlarmStatusDisarmed,
      {
        status_1: 'DISARMED',
        status_2: 'UNKNOWN',
        status_3: 'UNKNOWN',
        status_4: 'UNKNOWN'
      })

    // GetArea
    testMeianDataHandler('getStatus',
      'GetArea armed status',
      GetAreaArmedHome,
      {
        status_1: 'ARMED_HOME',
        status_2: 'DISARMED',
        status_3: 'DISARMED',
        status_4: 'DISARMED'
      }
    )
    testMeianDataHandler('getStatus',
      'GetArea disarmed status',
      GetAreaDisarmed,
      {
        status_1: 'DISARMED',
        status_2: 'DISARMED',
        status_3: 'DISARMED',
        status_4: 'DISARMED'
      }
    )

    // ignoring zone 4 and 5
    testMeianDataHandler('zoneFilter',
      'ignoring zone 4 and 5',
      [
        GetByWay.zones,
        zonesToQuery // ignoring zone 4 and 5
      ],
      GetByWay.zones.slice(0, 3))

    // filter zone 4
    testMeianDataHandler('getZoneInfo',
      'filtering zone 4',
      [
        GetByWay,
        4
      ],
      GetByWay.zones[3])

    testMeianDataHandler('mergeZonesInfo', 'merging GetByWay and GetZone', [GetByWay.zones, GetZone.zones], MERGED_ZONES)

    // GetAlarmStatus armed with 1 zone triggered
    testMeianDataHandler('getZoneStatus',
      'GetAlarmStatus armed with 1 zone triggered',
      [
        GetAlarmStatusArmedHome,
        GetByWayTriggered,
        GetZone,
        zonesToQuery
      ],
      {
        zones: MeianDataHandler.mergeZonesInfo(GetByWayTriggered.zones, GetZone.zones, zonesToQuery),
        status: {
          status_1: 'TRIGGERED',
          status_2: 'UNKNOWN',
          status_3: 'UNKNOWN',
          status_4: 'UNKNOWN'
        }
      })
    // GetAlarmStatus disarmed but with H24 triggered
    testMeianDataHandler('getZoneStatus',
      'GetAlarmStatus disarmed but with H24 triggered',
      [
        GetAlarmStatusDisarmed,
        GetByWayTriggered,
        GetZoneH24,
        zonesToQuery
      ],
      {
        zones: MeianDataHandler.mergeZonesInfo(GetByWayTriggered.zones, GetZoneH24.zones, zonesToQuery),
        status: {
          status_1: 'TRIGGERED',
          status_2: 'UNKNOWN',
          status_3: 'UNKNOWN',
          status_4: 'UNKNOWN'
        }
      })

    // GetArea armed with 1 zone triggered
    testMeianDataHandler('getZoneStatus',
      'GetArea armed with 1 zone triggered',
      [
        GetAreaArmedHome,
        GetByWayTriggered,
        GetZone,
        zonesToQuery
      ],
      {
        zones: MeianDataHandler.mergeZonesInfo(GetByWayTriggered.zones, GetZone.zones, zonesToQuery),
        status: {
          status_1: 'TRIGGERED',
          status_2: 'DISARMED',
          status_3: 'DISARMED',
          status_4: 'DISARMED'
        }
      })
    // GetArea disarmed but with H24 triggered
    testMeianDataHandler('getZoneStatus',
      ' GetArea disarmed but with H24 triggered',
      [
        GetAreaDisarmed,
        GetByWayTriggered,
        GetZoneH24,
        zonesToQuery
      ],
      {
        zones: MeianDataHandler.mergeZonesInfo(GetByWayTriggered.zones, GetZoneH24.zones, zonesToQuery),
        status: {
          status_1: 'TRIGGERED',
          status_2: 'DISARMED',
          status_3: 'DISARMED',
          status_4: 'DISARMED'
        }
      })
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
