<a name="MeianCommands"></a>

## MeianCommands
Handled message commands

**Kind**: global constant  

* [MeianCommands](#MeianCommands)
    * [.Client](#MeianCommands.Client) ⇒
    * [.Push](#MeianCommands.Push) ⇒
        * [.formatter()](#MeianCommands.Push.formatter)
    * [.GetAlarmStatus](#MeianCommands.GetAlarmStatus) ⇒
    * [.GetArea](#MeianCommands.GetArea) ⇒
    * [.SetArea](#MeianCommands.SetArea) ⇒
    * [.GetByWay](#MeianCommands.GetByWay) ⇒
    * [.GetZone](#MeianCommands.GetZone)
    * [.GetLog](#MeianCommands.GetLog)
    * [.GetNet](#MeianCommands.GetNet) ⇒
    * [.SetAlarmStatus](#MeianCommands.SetAlarmStatus) ⇒
    * [.SetByWay](#MeianCommands.SetByWay)

<a name="MeianCommands.Client"></a>

### MeianCommands.Client ⇒
Login

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| uid | <code>\*</code> | user id |
| pwd | <code>\*</code> | password |

<a name="MeianCommands.Push"></a>

### MeianCommands.Push ⇒
Push subscribe

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| uid | <code>\*</code> | uid for subscription |

<a name="MeianCommands.Push.formatter"></a>

#### Push.formatter()
This formats the "Alarm" command response:

```xml
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
```

**Kind**: static method of [<code>Push</code>](#MeianCommands.Push)  
<a name="MeianCommands.GetAlarmStatus"></a>

### MeianCommands.GetAlarmStatus ⇒
Get current alarm status

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  
<a name="MeianCommands.GetArea"></a>

### MeianCommands.GetArea ⇒
Get area status (Alarm areas used by Focus FC-7688Plus, not working in Meian ST-IVCGT)

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>\*</code> | request offset |

<a name="MeianCommands.SetArea"></a>

### MeianCommands.SetArea ⇒
Set area status

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| numArea | <code>\*</code> | number of aread |
| status | <code>\*</code> | status (arm, disarm, stay, clear) |

<a name="MeianCommands.GetByWay"></a>

### MeianCommands.GetByWay ⇒
get sensor status (alarm/open/closed, problem, lowbat, bypass, etc)

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>\*</code> | request offset |

<a name="MeianCommands.GetZone"></a>

### MeianCommands.GetZone
All zones status (fault, battery, loss, etc)

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>\*</code> | request offset |

<a name="MeianCommands.GetLog"></a>

### MeianCommands.GetLog
List of events recorded in the alarm (arm, disarm, bypass, alert, etc). The list is composed by 512 events and every message contains 2 of them: it may take some time to get the full list

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  

| Param | Type | Description |
| --- | --- | --- |
| offset | <code>\*</code> | request offset |

<a name="MeianCommands.GetNet"></a>

### MeianCommands.GetNet ⇒
Network config (mac address, ip, etc) and alarm name

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  
<a name="MeianCommands.SetAlarmStatus"></a>

### MeianCommands.SetAlarmStatus ⇒
Set current alarm status

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  
**Returns**: data response  

| Param | Type | Description |
| --- | --- | --- |
| status | <code>\*</code> | status (arm, disarm, stay, clear) |

<a name="MeianCommands.SetByWay"></a>

### MeianCommands.SetByWay
Set bypass for sensor

**Kind**: static property of [<code>MeianCommands</code>](#MeianCommands)  

| Param | Type | Description |
| --- | --- | --- |
| zone | <code>\*</code> | zone index |
| bypassed | <code>\*</code> | true or false |

