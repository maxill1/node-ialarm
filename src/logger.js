
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
  return logger
}
