import EventEmitter from 'events'

/**
 * Events related to the Alarm
 */
const MeianEvents = {
  events: (() => {
    const emitter = new EventEmitter()
    // cmdResponse listener may reach multiple units in GetLog call, but removeListener done in onCommandResponse should contain the number
    emitter.setMaxListeners(25)
    return emitter
  })(),
  clear: () => {
    MeianEvents.events.removeAllListeners('cmdResponse')
  },
  /**
   * Connected and ready for messages
   * @param {*} type
   */
  connected: (connectionTime) => {
    MeianEvents.events.emit('connected', connectionTime)
  },
  /**
   * Do stuff on connection
   */
  onConnected: (callback) => {
    MeianEvents.events.on('connected', callback)
  },
  /**
   * disconnected (error, by client, etc)
   * @param {*} type
   */
  disconnected: (type, data) => {
    MeianEvents.events.emit('disconnected', !type ? 'app requested disconnection' : type, data)
    MeianEvents.clear()
  },

  /**
   * Do stuff on discconnection
   */
  onDisconnected: (callback) => {
    MeianEvents.events.on('disconnected', callback)
  },
  /**
   * Notify the client that an error has occourred
   * @param {*} errorData
   */
  error: (errorData) => {
    if (errorData.stack) {
      MeianEvents.events.emit('error', errorData)
    } else {
      MeianEvents.events.emit('error', new Error(errorData))
    }
  },
  /**
   * Do stuff on error
   */
  onError: (callback) => {
    MeianEvents.events.on('error', callback)
  },
  /**
   * Notify the client that some message has been received
   * @param {*} data
   */
  response: (data) => {
    MeianEvents.events.emit('response', data)
  },
  /**
   * Do stuff on response
   */
  onResponse: (callback) => {
    MeianEvents.events.on('response', callback)
  },
  /**
   * Single command response
   * @param {*} data
   */
  commandResponse: (cmd, data) => {
    const id = `cmdResponse${cmd}`
    MeianEvents.events.emit(id, data)
  },
  /**
   * Single command response
   * @param {*} data
   */
  onCommandResponse: (cmd, callback) => {
    const id = `cmdResponse${cmd}`
    const onCmdResponse = (arg1, arg2, arg3, arg4) => {
      // console.log(`${id}: Removing 1 Listeners (total: ${MeianEvents.events.listenerCount(id)})`)

      // prevent EventEmitter memory leak
      MeianEvents.events.removeListener(id, onCmdResponse)
      callback(arg1, arg2, arg3, arg4)
    }
    MeianEvents.events.on(id, onCmdResponse)
  },
  /**
   * notify to client that a push notification has been received (Alarm)
   * @param {*} connectionTime
   */
  push: (connectionTime) => {
    MeianEvents.events.emit('push', connectionTime)
  },
  /**
   * Do stuff on Push notification received (Alarm)
   * @param {*} callback
   */
  onPush: (callback) => {
    MeianEvents.events.on('push', callback)
  }
}

export default MeianEvents
