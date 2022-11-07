# node-ialarm
A node library to control Meian TCP alarms and other chinese 'TCP IP' alarm system (Focus, Emooluxr, iAlarm/Antifurto365, Casasicura, etc)

inspired by these projects 
* https://github.com/RyuzakiKK/pyialarm
* https://github.com/wildstray/meian-client


## CLI

```
npx meian-cli
```

will print the help:

```
  -c, --commands  List of commands to execute. Can contain args: SetByWay(2,fals
                  e)                                       [vettore] [richiesto]
  -s, --host      ip of the alarm                                    [richiesto]
  -n, --port      TCP port                         [numero] [predefinito: 18034]
  -u, --username  Username required for logging in         [stringa] [richiesto]
  -p, --password  Password required for logging in         [stringa] [richiesto]
  -z, --zones     Number of configured zones         [numero] [predefinito: 128]
  -o, --output    JSON file where to dump the output of the commands   [stringa]
```

Basic example:

```
npx meian-cli -c GetByWay -s 192.168.1.81 -u MyUsername -p MyPassword 
```

Example with 40 zones, multiple commands and dump to file:

```
npx meian-cli -c GetNet -c GetAlarmStatus -c GetZone -c GetByWay -c SetByWay(1,true) -c GetLogs -s 192.168.1.81 -u MyUsername -p MyPassword -z 40 -o /MyFolder/dump.json
```

N.B. with bash you may wraè commands with args in "

```
npx meian-cli -c "SetByWay(1,true)" -s 192.168.1.81 -u MyUsername -p MyPassword 
```

### aliases

```
npx ialarm-cli 
```

## Library Installation
```
npm install node-ialarm
```

### Commands

See [Commands](Commands.md)


### Usage

```javascript
import { MeianSocket } from 'ialarm'


const socket = MeianSocket('192.168.1.81', 18034, 'username', 'password', 'debug', 40)

/**
   * ready to send commands
   */
socket.onConnected(async (connectionResponse) => {
  console.log(`logged in (${connectionResponse})`)
})

// command
socket.onResponse(async (commandResponse) => {
  console.log(JSON.stringify(commandResponse))
})

// push events
socket.onPush(async (pushResponse) => {
  console.log(`Received push: ${JSON.stringify(pushResponse)}`)
})

socket.onDisconnected(async (disconnectionResponse) => {
  console.log(`disconnected (type: ${disconnectionResponse})`)
})

socket.onError(async (error) => {
  console.log(`Error ${error.message} - ${JSON.stringify(error.stack)}`)
})

/**
 * ready to send commands
 */
socket.onConnected(async (connectionResponse) => {
  console.log(`logged in (${connectionResponse})`)
})

// connect
socket.connect()

// wait for connection before sending data
const polling = setInterval(async () => {
  if (socket.connection.status.isReady()) {
    clearInterval(polling)

    const commands = ['GetNet', 'GetAlarmStatus', 'GetByWay']
    const commandsArgs = [[], []. [1]]
    console.log(`Testing ${JSON.stringify(current)} (${JSON.stringify(commandsArgs)})...`)

    // send commands
    await socket.executeCommand(commands, commandsArgs)

  } else {
    console.log(`Connection not ready yet for receiving data - ${socket.connection.status.text()}...will try again later..`)
  }
}, 1000)


// delay disconnection for testing purposes
setTimeout(() => {
  socket.disconnect()
}, 120000)

```
