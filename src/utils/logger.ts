import bunyan from 'bunyan';
import path from 'path';

const logDir = path.resolve(__dirname, '../../logs');

export const logger = bunyan.createLogger({
  name: 'web-analytics-backend',
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'info',
      path: `${logDir}/info.log`,
    },
    {
      level: 'warn',
      path: `${logDir}/warn.log`,
    },
    {
      level: 'error',
      path: `${logDir}/error.log`,
    },
  ],
});
