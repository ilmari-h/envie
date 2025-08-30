import winston from 'winston';
import { getAppDataDirectory } from './utils/directories';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.cli({
    level: true
  }),
  transports: [
    new winston.transports.File({ dirname: getAppDataDirectory(), filename: 'error.log', level: 'error' }),
    new winston.transports.File({ dirname: getAppDataDirectory(), filename: 'combined.log' })
  ],
});

export default logger;