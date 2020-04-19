const INIT = {
	/*
                b"@ieM0071000100000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^dY'BpptGy64x\x1e\x7fhec|xa\x1d0^|-xqFI%Xc\x1ejk2\x03QYa0\x17\x1c!\rL\x130001"
                b"0}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^dY'BpptGy64x\x1e\x7fhec|xa\x1d0^|-xqFI%Xc\x1ejk2\x03QYa0\x17\x1c!\rL\x13"
                */
	raw: '@ieM0071000100000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^dY\'BpptGy64x\x1e\x7fhec|xa\x1d0^|-xqFI%Xc\x1ejk2\x03QYa0\x17\x1c!\rL\x130001',
	xml: '<Err>ERR|00</Err><Root><Pair><Client><Err></Err></Client></Pair></Root>',
	json: {
		Err : 'ERR|00',
		Root: {
			Pair : {
				Client: {
					Err: {}
				}
			}
		}
	}
};
/*
const TEST_WLS_STATUS = {
    raw: '@ieM0113000200000j!!\x16\x06\x11*aK:px\x7fHDXTXk_m.\x17G\x06r~;!\x18\x15,\x11;x\x1e\x7f\x02Up6zr\x0c#A2/k\x1d~A-F)\x1c\x050\x03\x16MXa0\x17\x1d:\x03LX\x110\x04\x1d*z\x10\x1f\x03JJY\x06\x17#\x1d\x07@o\\C\x1dZW_e\'d0\x11\x0bAde\x06rM\nKXh/0002',
    xml: '<Root><Host><GetWlsStatus><Num/><Bat></Bat><Tamp></Tamp><Status></Status><Err></Err></GetWlsStatus></Host></Root>'
  }
const TEST_WLS_LIST = {
    raw: '@ieM0105000300000j!!\x16\x06\x11*aK:px\x7fHDXTXtB\x7f.\\\x08l!D/ \x18\x15,\x1c<jS&Y)Bqvbhn\x1c>!k\x1deF&ErThx.\x0c\x06\x17p@Vpr\'J_\\2\x17\x1d*z\x10\x1f\x03H]_oG\x7f\x16\x0bGL\x0e\x0cafYXdjf#l,Ac/0003',
    xml: '<Root><Host><GetWlsList><Total/><Offset>S32,0,0|0</Offset><Ln></Ln><Err></Err></GetWlsList></Host></Root>'
  }
const TEST_ALARM_SET = {
    raw: '@ieM0122000400000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^|W=DppdNd\x126mR.~cp61=f~h\'g\x04FKT5E)t\x0f\x14N&qx\x1e^u2\x7f^\x17i\x07xk,9|[P\x123}YJ\x150u\'FJ\x0e\x0ca}S_Q8;~S\x10ZveM=\\d\x0b\x7fsb#\x0c~\x0f\x12CxTr0004',
    xml: '<Root><Host><SetAlarmStatus><DevStatus>TYP,DISARM|1</DevStatus><Err></Err></SetAlarmStatus></Host></Root>'
  }
const TEST_ALARM_STATUS = {
    raw: '@ieM0122000500000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^|W=DpppNd\x126mR.~cp61=f~h\'g\x04FKT5E)t\x0f\x14N&qx\x1e^u2\x7f^\x17i\x07xk,9|[P\x123}YJ\x150u\'FJ\x0e\x0caiS_Q8;~S\x10ZveM=\\d\x0b\x7fsb#\x0c~\x0f\x12CxTr0005',
    xml: '<Root><Host><GetAlarmStatus><DevStatus>TYP,DISARM|1</DevStatus><Err></Err></GetAlarmStatus></Host></Root>'
  }
const TEST_EVENTS = {
    raw: '@ieM0426000700000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^|W=DpppNd\x16,iN7^)-\x16+:9.\x12\x11\"e\x1e\x18\x18l\x04/\\d|^MlD+mTpr-^K\x11kLf\x0b;\x1c\x0f\x1c#\t\x1fD\x1a8fM{^VC+Z\x08\x17\\:d_\rq\x02\'=\nv\x1ei\x10\x0b3]9\x0c~lp\x12Dt\x1ehz\x1e}\x1a\":\x04a\x02R\x06\x11.?\x06\x1d\x1a\x16\x14\x19L>\x0b\x13\x0c\x17#\x16S\n\x04\x02\x02p\x1fcy<g&?\x13{\x19+>\x0evpd\x0e\x1f|B\x03`\x06\x14<\x07$\x18gxM.\x0b\x15c@\x0cp\x1d6j\x01Vr\tkh>\x12\x0c`;\x06\x17t\x1e2\t6f\x14\x04L\x7f\x1a\x03\x1e,{\x169\x00\x7fb!/k\x1a0t\x10K-\'g\x00~\x0f\x0c\x1a)\x1c\x00sp1\x18|>8D\x7f{U\x08\x11MB\x0fpr\x08\x00\x13c[j\x07\x0cW?iR\x06\x04a|vr\x0bg)m\tXro\x19k qq~dm`{/k~\x1b\x10~eCrzp\x1eQ\r\x1co0\x17\x02\x7fR\x06\x11.?\tf\x0b\\|\x0f\x18s\x0b\x18\r\x1b0u.\x05\t\x0e\x0c\x02\x1f\x04\x15C\x00\x08 \n?\x1f$&\x08rM\x14\x15\x05\"-\x1b\x03q\x1e\x13xE\x0cx8}Q{\x1e.#t\x7f}\\\x04h\x10|\x06ra\x01J_\x0e3\x17l]_I,\x07ZL=\x0erc\x7fDc\'d0\x0f\x11Bxe|0007',
    xml: '<Root><Host><GetEvents><Total>S32,28,28|28</Total><Offset>S32,0,14|14</Offset><Ln>S32,0,28|14</Ln><L0>STR,4|1406</L0><L1>STR,4|1384</L1><L2>STR,4|3384</L2><L3>STR,4|1381</L3><L4>STR,4|1306</L4><L5>STR,4|1455</L5><L6>STR,4|1602</L6><L7>STR,4|1570</L7><L8>STR,4|3302</L8><L9>STR,4|1350</L9><L10>STR,4|3570</L10><L11>STR,4|3350</L11><L12>STR,4|1370</L12><L13>STR,4|3370</L13><Err></Err></GetEvents></Host></Root>'
  }
const TEST_SENSOR = {
    raw: '@ieM0357000800000}<<\\}\x7f0r\x08~rk}_B1\x04yWDxd^|W=DpppNd\x00?bS,_)-\x16+:9.\x12\x11\"e\x1e\x1a\x0cs\x04k\x13dxM6W_>`\x06r\x01\x04^^\x07z\x06\x0bk: \x02\x13\x00<\nW\x08\x17#\x15\x04RKUDp\x12zE.\x07i >\x12s\x02$#Dv ^ whY\"-\x1b\x02|n\x15a;\x19`}2R\x7f\x1d\" ?\x00~~R\x04\x02.>\x06r\x02u\x06ceB\x14\x12\x14\x12pjT\x05\x08\x7f\x03~|\x07\x17 ?\x1fk2\x1c\x0f\x1f) _\x17\tban\x15 >#e\x07\x1a\x13p\x06\'\x10jk.P\x06\x17\x13?\x06\x00\x1b/\x14\x14N7Dhk1\x1e\x12\x1d?\x01\x18\x04\x04@i\\\x08t\x04\x0e\x00{{\x07)xcp\x0fr\x19% \t~Rh\x18\x18P%i\x0e\x0e\x15~bBm`}b[0\x1e#=\x08~wR\x08\x1d^!t{pxt\x1b\x0eAmf\x14\x12 c\x1e\x05\x01\x7f\x00|t\x07\x1b ou@\x16}\x11[&|\n\x1b\x15n\x15n(+\x00\x1f\x15r\x07\'\x10ft^Mt\x1ca0}<<\\\x04\x02\'|Jfd\'iFX\\]EKD~d^\x1bp_C:\x10\n\x04B;5x\x000008',
    xml: '<Root><Host><GetSensor><Total>S32,0,32|32</Total><Offset>S32,0,32|0</Offset><Ln>S32,0,32|8</Ln><L0>NUM,9,9|033038000</L0><L1>NUM,9,9|061013000</L1><L2>NUM,9,9|225030000</L2><L3>NUM,9,9|039011093</L3><L4>NUM,9,9|117211000</L4><L5>NUM,9,9|011009000</L5><L6>NUM,9,9|191028000</L6><L7>NUM,9,9|255210000</L7><Err></Err></GetSensor></Host></Root>'
  } */


module.exports = {
	INIT : INIT
};
