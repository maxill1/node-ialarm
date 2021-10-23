const INIT = {
  raw: '@ieM0071000100000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^dY\'BpptGy64x\x1e\x7fhec|xa\x1d0^|-xqFI%Xc\x1ejk2\x03QYa0\x17\x1c!\rL\x130001',
  xml: '<Err>ERR|00</Err><Root><Pair><Client><Err></Err></Client></Pair></Root>',
  json: {
    Err: 'ERR|00',
    Root: {
      Pair: {
        Client: {
          Err: {}
        }
      }
    }
  }
}

// inizia da \x40\x69\x65\x4d\x30=@ieM
const STATUS = {
  raw:

  '\x40\x69\x65\x4d\x30\x31\x31\x31\x30\x30' +
'\x30\x31\x30\x30\x30\x30\x30\x6a\x21\x21\x16\x06\x11\x2a\x61\x4b' +
'\x3a\x70\x78\x7f\x48\x44\x4e\x54\x4a\x4a\x46\x5f\x2e\x03\x40\x4d' +
'\x3d\x0e\x72\x08\x52\x5d\x43\x27\x3b\x78\x55\x30\x13\x43\x48\x12' +
'\x68\x0a\x11\x11\x6d\x10\x5c\x2b\x03\x16\x0f\x04\x53\x61\x73\x22' +
'\x25\x16\x17\x4b\x15\x63\x49\x4a\x3c\x70\x27\x6a\x7f\x1e\x3e\x08' +
'\x64\x77\x4d\x5c\x51\x12\x33\x17\x6c\x5d\x5f\x4d\x36\x03\x46\x55' +
'\x63\x44\x2f\x5a\x43\x58\x2e\x68\x75\x44\x51\x30\x5a\x29\x2d\x17' +
'\x1c\x0d\x37\x50\x09\x30\x30\x30\x31',
  xml: '<Root><Host><GetAlarmStatus><DevStatus>TYP,DISARM|1</DevStatus><Err>ERR|00</Err></GetAlarmStatus></Host></Root>',
  json: {
    Err: 'ERR|00',
    Root: {
      Pair: {
        Client: {
          Err: {}
        }
      }
    }
  }
}

// \x40\x69\x65\x4d\x30
module.exports = {
  INIT: INIT,
  STATUS: STATUS,
  GetByWay: { Root: { Host: { GetByWay: { Total: { value: 'S32,0,40|40' }, Offset: { value: 'S32,0,40|0' }, Ln: { value: 'S32,0,40|16' }, L0: { value: 'S32,1,255|5' }, L1: { value: 'S32,1,255|1' }, L2: { value: 'S32,1,255|1' }, L3: { value: 'S32,1,255|1' }, L4: { value: 'S32,1,255|1' }, L5: { value: 'S32,1,255|1' }, L6: { value: 'S32,1,255|1' }, L7: { value: 'S32,1,255|1' }, L8: { value: 'S32,1,255|1' }, L9: { value: 'S32,1,255|1' }, L10: { value: 'S32,1,255|1' }, L11: { value: 'S32,1,255|1' }, L12: { value: 'S32,1,255|1' }, L13: { value: 'S32,1,255|1' }, L14: { value: 'S32,1,255|1' }, L15: { value: 'S32,1,255|13' }, Err: {} } } }, Err: 'ERR|00' },
  GetEvents: { Root: { Host: { GetEvents: { Total: { value: 'S32,28,28|28' }, Offset: { value: 'S32,0,0|0' }, Ln: { value: 'S32,0,28|14' }, L0: { value: 'STR,4|1134' }, L1: { value: 'STR,4|1131' }, L2: { value: 'STR,4|1132' }, L3: { value: 'STR,4|1120' }, L4: { value: 'STR,4|1133' }, L5: { value: 'STR,4|1110' }, L6: { value: 'STR,4|1100' }, L7: { value: 'STR,4|1137' }, L8: { value: 'STR,4|3401' }, L9: { value: 'STR,4|1401' }, L10: { value: 'STR,4|3441' }, L11: { value: 'STR,4|1302' }, L12: { value: 'STR,4|1301' }, L13: { value: 'STR,4|3301' }, Err: {} } } }, Err: 'ERR|00' },
  GetLog: { Root: { Host: { GetLog: { Total: { value: 'S32,0,512|512' }, Offset: { value: 'S32,0,512|0' }, Ln: { value: 'S32,0,512|2' }, L0: { Time: { value: 'DTA,19|2020.06.04.18.40.03' }, Area: { value: 'S32,1,40|70' }, Event: { value: 'STR,4|1406' } }, L1: { Time: { value: 'DTA,19|2020.06.04.18.35.15' }, Area: { value: 'S32,1,40|16' }, Event: { value: 'STR,4|1133' } }, Err: {} } } }, Err: 'ERR|00' },
  GetZone: { Root: { Host: { GetZone: { Total: { value: 'S32,0,40|40' }, Offset: { value: 'S32,0,40|0' }, Ln: { value: 'S32,0,40|2' }, L0: { Type: { value: 'TYP,DE|1' }, Voice: { value: 'TYP,CX|1' }, Name: { value: 'GBA,16|496E67726573736F' } }, L1: { Type: { value: 'TYP,SI|2' }, Voice: { value: 'TYP,CX|1' }, Name: { value: 'GBA,16|536F6767696F726E6F203346' } }, Err: {} } } }, Err: 'ERR|00' },
  GetArea: {
    Root: {
      Host: {
        GetArea: {
          Total: {
            value: 'S32,4,4|4'
          },
          Offset: {
            value: 'S32,0,0|0'
          },
          Ln: {
            value: 'S32,0,4|4'
          },
          L0: {
            Status: {
              value: 'TYP,STAY|2'
            }
          },
          L1: {
            Status: {
              value: 'TYP,DISARM|1'
            }
          },
          L2: {
            Status: {
              value: 'TYP,DISARM|1'
            }
          },
          L3: {
            Status: {
              value: 'TYP,DISARM|1'
            }
          },
          Err: {}
        }
      }
    }
  },
  SetArea: {
    Root: {
      Host: {
        SetArea: {
          Pos: {
            value: 'S32,0,3|0'
          },
          Status: {
            value: 'TYP,STAY|2'
          },
          Err: {}
        }
      }
    },
    Err: 'ERR|00'
  }
}
