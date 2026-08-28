import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private transporter?: nodemailer.Transporter;
  private resend?: Resend;
  private readonly provider: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('mail.provider') || 'smtp';

    if (this.provider === 'resend') {
      this.resend = new Resend(
        this.configService.getOrThrow<string>('mail.resendApiKey'),
      );
    } else if (this.provider !== 'brevo' && this.provider !== 'gmail-api') {
      this.transporter = nodemailer.createTransport({
        service: this.configService.get<string>('mail.service'),
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port'),
        secure: this.configService.get<boolean>('mail.secure'),
        connectionTimeout: this.configService.get<number>(
          'mail.connectionTimeout',
        ),
        greetingTimeout: this.configService.get<number>('mail.greetingTimeout'),
        socketTimeout: this.configService.get<number>('mail.socketTimeout'),
        auth: {
          user: this.configService.get<string>('mail.user'),
          pass: this.configService.get<string>('mail.password'),
        },
      });
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('mail.from'),
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    try {
      if (this.provider === 'resend') {
        await this.sendWithResend(mailOptions);
      } else if (this.provider === 'brevo') {
        await this.sendWithBrevo(mailOptions);
      } else if (this.provider === 'gmail-api') {
        await this.sendWithGmailApi(mailOptions);
      } else {
        await this.transporter?.sendMail(mailOptions);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  private async sendWithResend(
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend client is not configured');
    }

    const { error } = await this.resend.emails.send({
      from: mailOptions.from as string,
      to: mailOptions.to as string | string[],
      subject: mailOptions.subject as string,
      html: mailOptions.html as string,
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }
  }

  private async sendWithBrevo(
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<void> {
    const apiKey = this.configService.getOrThrow<string>('mail.brevoApiKey');
    const from = this.parseFromAddress(mailOptions.from as string);

    const response = await fetch(BREVO_EMAIL_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: from,
        to: [{ email: mailOptions.to as string }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
    }
  }

  private async sendWithGmailApi(
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<void> {
    const clientId =
      this.configService.getOrThrow<string>('mail.gmailClientId');
    const clientSecret = this.configService.getOrThrow<string>(
      'mail.gmailClientSecret',
    );
    const refreshToken = this.configService.getOrThrow<string>(
      'mail.gmailRefreshToken',
    );
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(
        `Google OAuth token error (${tokenResponse.status}): ${errorBody}`,
      );
    }

    const { access_token: accessToken } = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!accessToken) {
      throw new Error(
        'Google OAuth token response did not include access_token',
      );
    }

    const rawMessage = this.createRawMessage(mailOptions);
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawMessage }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
    }
  }

  private createRawMessage(mailOptions: nodemailer.SendMailOptions): string {
    const from = mailOptions.from as string;
    const to = mailOptions.to as string;
    const subject = mailOptions.subject as string;
    const html = mailOptions.html as string;
    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${this.encodeMimeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
    ].join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private encodeMimeHeader(value: string): string {
    if (/^[\x00-\x7F]*$/.test(value)) {
      return value;
    }

    return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
  }

  private parseFromAddress(from: string): { email: string; name?: string } {
    const match = from.match(/^(.+?)\s*<([^<>]+)>$/);

    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }

    return { email: from.trim() };
  }

  async sendVerificationEmail(
    to: string,
    token: string,
    studentName: string,
  ): Promise<void> {
    const appUrl =
      this.configService.get<string>('app.url') || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/change-password?token=${encodeURIComponent(token)}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background-color: #f9f9f9; }
    .button { display: inline-block; background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .info-box { background-color: #fff; border-left: 4px solid #4A90E2; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Xác nhận Email</h1>
    </div>
    <div class="content">
      <p>Xin chào <strong>${studentName}</strong>,</p>
      <p>Bạn đã được tạo tài khoản trên hệ thống Quản lý Khóa luận tốt nghiệp.</p>
      
      <div class="info-box">
        <p><strong>Tài khoản đăng nhập:</strong></p>
        <p>Username: Vui lòng sử dụng mã sinh viên của bạn</p>
        <p>Mật khẩu tạm: <strong>1111</strong></p>
      </div>
      
      <p>Vui lòng click vào nút bên dưới để xác nhận email của bạn:</p>
      
      <p style="text-align: center;">
        <a href="${verifyUrl}" class="button">Xác nhận Email</a>
      </p>
      
      <p>Hoặc copy link sau vào trình duyệt:</p>
      <p style="word-break: break-all; font-size: 12px; color: #666;">${verifyUrl}</p>
      
      <p><strong>Lưu ý:</strong></p>
      <ul>
        <li>Link xác nhận có hiệu lực trong <strong>24 giờ</strong></li>
        <li>Sau khi xác nhận, bạn cần đổi mật khẩu trước khi đăng nhập</li>
      </ul>
    </div>
    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống. Vui lòng không reply email này.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail({
      to,
      subject: 'Xác nhận Email - Hệ thống Quản lý Khóa luận',
      html,
    });
  }

  async sendPasswordChangedNotification(
    to: string,
    studentName: string,
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #27AE60; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background-color: #f9f9f9; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thông báo thay đổi mật khẩu</h1>
    </div>
    <div class="content">
      <p>Xin chào <strong>${studentName}</strong>,</p>
      <p>Mật khẩu tài khoản của bạn đã được thay đổi thành công.</p>
      <p>Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ với quản trị viên ngay lập tức.</p>
    </div>
    <div class="footer">
      <p>Email này được gửi tự động từ hệ thống.</p>
    </div>
  </div>
</body>
</html>
    `;

    await this.sendEmail({
      to,
      subject: 'Thông báo thay đổi mật khẩu',
      html,
    });
  }
}
