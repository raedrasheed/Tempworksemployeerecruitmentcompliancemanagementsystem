import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly smtpConfigured: boolean;

  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly smtpFrom: string;
  private readonly frontendUrl: string;

  constructor(private config: ConfigService) {
    this.smtpHost = this.config.get<string>('SMTP_HOST', '');
    this.smtpPort = this.config.get<number>('SMTP_PORT', 587);
    this.smtpUser = this.config.get<string>('SMTP_USER', '');
    this.smtpPass = this.config.get<string>('SMTP_PASS', '');
    this.smtpFrom = this.config.get<string>('SMTP_FROM', 'noreply@tempworks.com');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    this.smtpConfigured = !!(this.smtpHost && this.smtpUser && this.smtpPass);

    if (!this.smtpConfigured) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS missing). ' +
        'Emails will be logged to console only. Set these env vars for production.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public send methods
  // ---------------------------------------------------------------------------

  async sendActivationEmail(
    to: string,
    name: string,
    token: string,
    frontendUrl: string,
  ): Promise<void> {
    const activationUrl = `${frontendUrl}/activate?token=${token}`;
    const subject = 'Activate Your TempWorks Account';
    const html = this.buildActivationTemplate(name, activationUrl);
    await this.sendMail(to, subject, html);
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    frontendUrl: string,
    isAdminInitiated: boolean,
  ): Promise<void> {
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const subject = isAdminInitiated
      ? 'Your TempWorks Password Has Been Reset by an Administrator'
      : 'Reset Your TempWorks Password';
    const html = this.buildPasswordResetTemplate(name, resetUrl, isAdminInitiated);
    await this.sendMail(to, subject, html);
  }

  async sendPasswordExpiredNotification(
    to: string,
    name: string,
    frontendUrl: string,
  ): Promise<void> {
    const loginUrl = `${frontendUrl}/login`;
    const subject = 'Your TempWorks Password Has Expired';
    const html = this.buildPasswordExpiredTemplate(name, loginUrl);
    await this.sendMail(to, subject, html);
  }

  async sendAccountLockedEmail(to: string, name: string): Promise<void> {
    const subject = 'Your TempWorks Account Has Been Temporarily Locked';
    const html = this.buildAccountLockedTemplate(name);
    await this.sendMail(to, subject, html);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to TempWorks!';
    const html = this.buildWelcomeTemplate(name);
    await this.sendMail(to, subject, html);
  }

  // ---------------------------------------------------------------------------
  // Core send logic with SMTP / console fallback
  // ---------------------------------------------------------------------------

  private async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.smtpConfigured) {
      this.logger.log(
        `[EMAIL FALLBACK — no SMTP configured] To: ${to} | Subject: ${subject}\n` +
        `Body preview: ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400)}`,
      );
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: { user: this.smtpUser, pass: this.smtpPass },
      });
      await transporter.sendMail({
        from: this.smtpFrom,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err?.message}`, err?.stack);
      // Graceful fallback — email failure must never break main flow
    }
  }

  // ---------------------------------------------------------------------------
  // HTML Templates
  // ---------------------------------------------------------------------------

  private baseTemplate(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: Arial, sans-serif; color: #333; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a56db; padding: 24px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; }
    .content { padding: 32px; line-height: 1.6; }
    .content p { margin: 0 0 16px; }
    .btn { display: inline-block; margin: 16px 0; padding: 12px 28px; background: #1a56db; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .footer { background: #f4f6f9; padding: 20px 32px; font-size: 12px; color: #666; text-align: center; }
    .notice { background: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>TempWorks</h1></div>
    <div class="content">${body}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TempWorks. This is an automated message — please do not reply.<br/>
      If you did not request this, please contact your administrator.
    </div>
  </div>
</body>
</html>`;
  }

  private buildActivationTemplate(name: string, activationUrl: string): string {
    const body = `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Welcome to TempWorks! Your account has been created and is ready to be activated.</p>
      <p>Click the button below to set your password and activate your account:</p>
      <a href="${activationUrl}" class="btn">Activate My Account</a>
      <p class="notice">This activation link expires in <strong>60 minutes</strong>. If it has expired, contact your administrator to resend it.</p>
      <p>If the button doesn't work, copy and paste the following link into your browser:</p>
      <p style="word-break:break-all;font-size:13px;color:#555;">${activationUrl}</p>
    `;
    return this.baseTemplate('Activate Your Account', body);
  }

  private buildPasswordResetTemplate(
    name: string,
    resetUrl: string,
    isAdminInitiated: boolean,
  ): string {
    const intro = isAdminInitiated
      ? `An administrator has initiated a password reset for your TempWorks account.`
      : `We received a request to reset the password for your TempWorks account.`;
    const body = `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>${intro}</p>
      <p>Click the button below to set a new password:</p>
      <a href="${resetUrl}" class="btn">Reset My Password</a>
      <p class="notice">This link expires in <strong>60 minutes</strong>.</p>
      <p>If you did not request a password reset, please ignore this email or contact your administrator immediately.</p>
      <p>If the button doesn't work, copy and paste the following link:</p>
      <p style="word-break:break-all;font-size:13px;color:#555;">${resetUrl}</p>
    `;
    return this.baseTemplate('Reset Your Password', body);
  }

  private buildPasswordExpiredTemplate(name: string, loginUrl: string): string {
    const body = `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Your TempWorks password has expired and must be changed before you can log in again.</p>
      <p>Please log in and follow the prompts to set a new password:</p>
      <a href="${loginUrl}" class="btn">Go to Login</a>
      <p class="notice">For security, passwords expire every 30 days. Please choose a strong, unique password.</p>
    `;
    return this.baseTemplate('Password Expired', body);
  }

  private buildAccountLockedTemplate(name: string): string {
    const body = `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Your TempWorks account has been <strong>temporarily locked</strong> due to multiple failed login attempts.</p>
      <p class="notice">Your account will automatically unlock after <strong>30 minutes</strong>. After that you may try logging in again.</p>
      <p>If you did not attempt to log in, your credentials may have been compromised. Please contact your administrator immediately.</p>
    `;
    return this.baseTemplate('Account Temporarily Locked', body);
  }

  private buildWelcomeTemplate(name: string): string {
    const body = `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Welcome to <strong>TempWorks</strong>! Your account is now active.</p>
      <p>You can log in at any time using your email address and the password you set during activation.</p>
      <p>If you have any questions, please contact your administrator.</p>
    `;
    return this.baseTemplate('Welcome to TempWorks', body);
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
