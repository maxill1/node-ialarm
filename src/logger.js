
const winston = require('winston')
module.exports = function (level) {
  const logger = winston.createLogger({
    levels: winston.config.syslog.levels,
    format: winston.format.simple(),
    transports: [
      // new winston.transports.Stream({
      //   stream: process.stderr,
      //   level: level || 'info'
      // })
      new winston.transports.Console({ level: level || 'info' })
    // new winston.transports.File({
    //   filename: 'combined.log',
    //   level: 'info'
    // })
    ]
  })
  logger.warn = function (arg1, arg2, arg3, arg4) {
    logger.log('warning', arg1, arg2, arg3, arg4)
  }
  logger.debug = function (arg1, arg2, arg3, arg4) {
    logger.log('debug', arg1, arg2, arg3, arg4)
  }

  return logger
}
