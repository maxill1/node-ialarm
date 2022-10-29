const net = require('net')
const constants = require('./constants')

const transactionToString = (transactionId, command, commandIndex, args) => {
  if (!transactionId && command === 'Alarm') {
    transactionId = 'push'
  }
  return `con-${MeianConnection.connectionName}${transactionId ? '/' + transactionId : ''}${command ? '-comm-' + command : ''}${commandIndex ? '-index-' + commandIndex : ''}${args ? '(' + JSON.stringify(args) + ')' : ''}`
}

const ConnectionStatus = {
  DISCONNECTED: 0,
  CONNECTING: 1, // connection started but not yet received a response
  CONNECTED: 2, // connection started but not yet received a response
  CONNECTED_AUTHENTICATING: 3, // connection ok, but not yet sent a login request
  CONNECTED_READY: 4, // connection ok and login ok. Ready to send a query
  CONNECTED_BUSY: 5, // connection ok and login ok and query sent and waiting for response
  value: 0,
  decode: (status) => {
    for (const name in ConnectionStatus) {
      if (name === 'decode' || name === 'value' || name.indexOf('is') === 0) {
        continue
      }
      if (ConnectionStatus[name] === status) {
        return name
      }
    }
    return ''
  },
  text: () => {
    return ConnectionStatus.decode(ConnectionStatus.value)
  },
  isStatus: (compare) => {
    return ConnectionStatus.value === compare
  },
  isConnected: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.CONNECTED)
  },
  isConnecting: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.CONNECTING)
  },
  isAuthenticating: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.CONNECTED_AUTHENTICATING)
  },
  isReady: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.CONNECTED_READY)
  },
  isPending: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.CONNECTED_BUSY)
  },
  isDisconnected: () => {
    return ConnectionStatus.isStatus(ConnectionStatus.DISCONNECTED)
  }
}

/**
 * singleton instance of socket
 */
const MeianConnection = {
  initLogger: (logLevel) => {
    MeianConnection.logger = require('./logger')(logLevel)
    return MeianConnection.logger
  },
  logger: undefined,
  socket: (function () {
    const s = new net.Socket()
    // socket timeout
    s.setTimeout(constants.socketTimeout)
    return s
  }()),
  // unique id for debug purposes
  connectionName: 'n/a',
  // client status
  status: ConnectionStatus,
  updateStatus: (currentStatus, transactionId, command, commandIndex, commandArgs) => {
    if (currentStatus > -1 && !MeianConnection.status.isStatus(currentStatus)) {
      MeianConnection.logger.log('debug', `${MeianConnection.transactionToString(transactionId, command, commandIndex, commandArgs)}: connection status changed from ${MeianConnection.status.text()}(${MeianConnection.status.value}) to ${ConnectionStatus.decode(currentStatus)}(${currentStatus})`)
      MeianConnection.status.value = currentStatus
    }
    if (transactionId && command) {
      // useful for debug purposes
      MeianConnection.transactions[command] = {
        transactionId,
        commandIndex,
        args: commandArgs
      }
    }
  },
  transactions: {},
  // unique id for debug purposes
  getTransaction: (commandName) => {
    const data = MeianConnection.transactions[commandName]
    if (data) {
      return data
    }
    return {}
  },
  transactionToString
}

module.exports.MeianConnection = MeianConnection
module.exports.ConnectionStatus = ConnectionStatus
