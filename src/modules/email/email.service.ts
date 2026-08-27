import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
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

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('mail.from'),
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
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
