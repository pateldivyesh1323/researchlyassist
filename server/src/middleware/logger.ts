import { Request, Response, NextFunction } from 'express';

const getTimestamp = () => {
  return new Date().toISOString();
};

const getColoredStatus = (statusCode: number): string => {
  if (statusCode >= 500) return `\x1b[31m${statusCode}\x1b[0m`;
  if (statusCode >= 400) return `\x1b[33m${statusCode}\x1b[0m`;
  if (statusCode >= 300) return `\x1b[36m${statusCode}\x1b[0m`;
  if (statusCode >= 200) return `\x1b[32m${statusCode}\x1b[0m`;
  return `${statusCode}`;
};

const getColoredMethod = (method: string): string => {
  const colors: Record<string, string> = {
    GET: '\x1b[32m',
    POST: '\x1b[34m',
    PUT: '\x1b[33m',
    DELETE: '\x1b[31m',
    PATCH: '\x1b[35m',
  };
  const color = colors[method] || '\x1b[0m';
  return `${color}${method}\x1b[0m`;
};

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    const logMessage = `[${getTimestamp()}] ${getColoredMethod(method.padEnd(6))} ${originalUrl} ${getColoredStatus(statusCode)} ${duration}ms - ${ip || 'unknown'}`;
    
    if (statusCode >= 400) {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
  });

  next();
};
