import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  service:
    process.env.EMAIL_SERVICE ||
    (process.env.EMAIL_HOST === 'smtp.gmail.com' ? 'gmail' : undefined),
  host:
    process.env.EMAIL_HOST === 'smtp.gmail.com'
      ? undefined
      : process.env.EMAIL_HOST,
  port:
    process.env.EMAIL_HOST === 'smtp.gmail.com'
      ? 465
      : parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure:
    process.env.EMAIL_HOST === 'smtp.gmail.com'
      ? true
      : process.env.EMAIL_SECURE === 'true',
  connectionTimeout:
    parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) || 10000,
  greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) || 10000,
  socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT, 10) || 20000,
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  from: process.env.EMAIL_FROM,
}));
