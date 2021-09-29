
module.exports = {

    /**
     * Events emitted on tcp command response
     */
    events: {
        default: 'response',
        GetZone: 'allZones',
        //TODO status, events, command zoneInfo zoneInfoError
    },

    cid: {
        1100: 'Personal ambulance',
        1101: 'Emergency',
        1110: 'Fire',
        1120: 'Emergency',
        1131: 'Perimeter',
        1132: 'Burglary',
        1133: '24 hour',
        1134: 'Delay',
        1137: 'Dismantled',
        1301: 'System AC fault',
        1302: 'System battery failure',
        1306: 'Programming changes',
        1350: 'Communication failure',
        1351: 'Telephone line fault',
        1370: 'Circuit fault',
        1381: 'Detector lost',
        1384: 'Low battery detector',
        1401: 'Disarm report',
        1406: 'Alarm canceled',
        1455: 'Automatic arming failed',
        1570: 'Bypass Report',
        1601: 'Manual communication test reports',
        1602: 'Communications test reports',
        3301: 'System AC recovery',
        3302: 'System battery recovery',
        3350: 'Communication resumes',
        3351: 'Telephone line to restore',
        3370: 'Loop recovery',
        3381: 'Detector loss recovery',
        3384: 'Detector low voltage recovery',
        3401: 'Arming Report',
        3441: 'Staying Report',
        3570: 'Bypass recovery'
    },


    TZ: {
        0: 'GMT-12:00',
        1: 'GMT-11:00',
        2: 'GMT-10:00',
        3: 'GMT-09:00',
        4: 'GMT-08:00',
        5: 'GMT-07:00',
        6: 'GMT-06:00',
        7: 'GMT-05:00',
        8: 'GMT-04:00',
        9: 'GMT-03:30',
        10: 'GMT-03:00',
        11: 'GMT-02:00',
        12: 'GMT-01:00',
        13: 'GMT',
        14: 'GMT+01:00',
        15: 'GMT+02:00',
        16: 'GMT+03:00',
        17: 'GMT+04:00',
        18: 'GMT+05:00',
        19: 'GMT+05:30',
        20: 'GMT+05:45',
        21: 'GMT+06:00',
        22: 'GMT+06:30',
        23: 'GMT+07:00',
        24: 'GMT+08:00',
        25: 'GMT+09:00',
        26: 'GMT+09:30',
        27: 'GMT+10:00',
        28: 'GMT+11:00',
        29: 'GMT+12:00',
        30: 'GMT+13:00',
    },

    ZoneTypes: {
        0: 'Disabilitata',
        1: 'Ritardata',
        2: 'Perimetrale',
        3: 'Interna',
        4: 'Emergenza',
        5: '24 ore',
        6: 'Incendio',
        7: 'Chiavi'
    },

    /**
     * Tipo suono sirena:
     */
    ZoneVoices: {
        1: 'Fisso',
        2: 'Ad impulsi',
        3: 'Muto'
    },

    zoneStatus: {
        1: {
            bypass: false,
            open: false,
            fault: false,
            alarm: false,
            lowbat: false,
            message: 'OK'
        },
        5: {
            bypass: true,
            open: false,
            fault: false,
            alarm: false,
            lowbat: false,
            message: 'Bypassed'
        },
        9: {
            bypass: false,
            open: false,
            fault: true,
            alarm: false,
            lowbat: false,
            message: 'Fault'
        },
        13: {
            bypass: true,
            open: false,
            fault: true,
            alarm: false,
            lowbat: false,
            message: 'Bypassed and fault'
        },
        //TODO more statuses
    }
};