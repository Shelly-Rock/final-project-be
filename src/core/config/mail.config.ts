import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  provider:
    process.env.EMAIL_PROVIDER?.trim().toLowerCase() ||
    (process.env.RESEND_API_KEY
      ? 'resend'
      : process.env.BREVO_API_KEY
        ? 'brevo'
        : process.env.GMAIL_REFRESH_TOKEN
          ? 'gmail-api'
          : 'smtp'),
  resendApiKey: process.env.RESEND_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,
  gmailClientId: process.env.GMAIL_CLIENT_ID,
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
  gmailUser: process.env.GMAIL_USER || process.env.EMAIL_USER,
  service:
    process.env.EMAIL_SERVICE ||
    (process.env.EMAIL_HOST === 'smtp.gmail.com' ? 'gmail' : undefined),
  host:
    process.env.EMAIL_HOST === 'smtp.gmail.com'
      ? undefined
      : process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  connectionTimeout:
    parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) || 10000,
  greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) || 10000,
  socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT, 10) || 20000,
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  from: process.env.EMAIL_FROM,
}));
