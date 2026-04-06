import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY', '');
    this.from = this.config.get<string>('SMTP_FROM', 'TempWorks <onboarding@resend.dev>');
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');

    if (this.apiKey) {
      this.logger.log(`Email service ready (Resend API). FROM: ${this.from}`);
    } else {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged to console only. ' +
        'Add RESEND_API_KEY=re_xxx to backend/.env to enable real email delivery.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public send methods
  // ---------------------------------------------------------------------------

  async sendActivationEmail(to: string, name: string, token: string, frontendUrl?: string): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/activate?token=${token}`;
    await this.sendMail(to, 'Activate Your TempWorks Account', this.buildActivationTemplate(name, url));
  }

  async sendPasswordResetEmail(to: string, name: string, token: string, frontendUrl?: string, isAdminInitiated = false): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/reset-password?token=${token}`;
    const subject = isAdminInitiated
      ? 'Your TempWorks Password Has Been Reset by an Administrator'
      : 'Reset Your TempWorks Password';
    await this.sendMail(to, subject, this.buildPasswordResetTemplate(name, url, isAdminInitiated));
  }

  async sendPasswordExpiredNotification(to: string, name: string, frontendUrl?: string): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/login`;
    await this.sendMail(to, 'Your TempWorks Password Has Expired', this.buildPasswordExpiredTemplate(name, url));
  }

  async sendAccountLockedEmail(to: string, name: string): Promise<void> {
    await this.sendMail(to, 'Your TempWorks Account Has Been Temporarily Locked', this.buildAccountLockedTemplate(name));
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendMail(to, 'Welcome to TempWorks!', this.buildWelcomeTemplate(name));
  }

  // ---------------------------------------------------------------------------
  // Core send — calls Resend REST API directly (no SDK, no SMTP)
  // ---------------------------------------------------------------------------

  private sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      const preview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
      this.logger.log(`[EMAIL FALLBACK] To: ${to} | Subject: ${subject}\nPreview: ${preview}`);
      return Promise.resolve();
    }

    const payload = JSON.stringify({ from: this.from, to, subject, html });

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(body);
                this.logger.log(`Email sent to ${to} | id: ${parsed?.id ?? 'n/a'}`);
              } catch {
                this.logger.log(`Email sent to ${to}`);
              }
            } else {
              this.logger.error(`Resend API error ${res.statusCode} for ${to}: ${body}`);
            }
            resolve();
          });
        },
      );

      req.on('error', (err) => {
        this.logger.error(`Failed to send email to ${to}: ${err.message}`);
        resolve(); // Graceful — never let email failure break main flow
      });

      req.write(payload);
      req.end();
    });
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
    body { margin:0; padding:0; background:#f4f6f9; font-family:Arial,sans-serif; color:#333; }
    .wrapper { max-width:600px; margin:40px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:#1a56db; padding:24px 32px; }
    .header h1 { margin:0; color:#fff; font-size:22px; }
    .content { padding:32px; line-height:1.6; }
    .content p { margin:0 0 16px; }
    .btn { display:inline-block; margin:16px 0; padding:12px 28px; background:#1a56db; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; }
    .footer { background:#f4f6f9; padding:20px 32px; font-size:12px; color:#666; text-align:center; }
    .notice { background:#fff8e1; border-left:4px solid #f59e0b; padding:12px 16px; margin:16px 0; border-radius:4px; font-size:13px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>TempWorks</h1></div>
    <div class="content">${body}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TempWorks. Automated message — do not reply.<br/>
      If you did not request this, contact your administrator.
    </div>
  </div>
</body>
</html>`;
  }

  private buildActivationTemplate(name: string, url: string): string {
    return this.baseTemplate('Activate Your Account', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Welcome to TempWorks! Your account has been created and is ready to activate.</p>
      <p>Click the button below to set your password and activate your account:</p>
      <a href="${url}" class="btn">Activate My Account</a>
      <p class="notice">This link expires in <strong>60 minutes</strong>. Contact your admin to resend if it expires.</p>
      <p>If the button doesn't work, copy this link into your browser:</p>
      <p style="word-break:break-all;font-size:13px;color:#555;">${url}</p>
    `);
  }

  private buildPasswordResetTemplate(name: string, url: string, isAdminInitiated: boolean): string {
    const intro = isAdminInitiated
      ? 'An administrator has initiated a password reset for your account.'
      : 'We received a request to reset your TempWorks password.';
    return this.baseTemplate('Reset Your Password', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>${intro}</p>
      <a href="${url}" class="btn">Reset My Password</a>
      <p class="notice">This link expires in <strong>60 minutes</strong>.</p>
      <p>If you didn't request this, ignore this email or contact your admin.</p>
      <p style="word-break:break-all;font-size:13px;color:#555;">${url}</p>
    `);
  }

  private buildPasswordExpiredTemplate(name: string, url: string): string {
    return this.baseTemplate('Password Expired', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Your TempWorks password has expired. Please log in and set a new one.</p>
      <a href="${url}" class="btn">Go to Login</a>
      <p class="notice">Passwords expire every 30 days. Please choose a strong, unique password.</p>
    `);
  }

  private buildAccountLockedTemplate(name: string): string {
    return this.baseTemplate('Account Temporarily Locked', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Your TempWorks account has been <strong>temporarily locked</strong> due to multiple failed login attempts.</p>
      <p class="notice">It will automatically unlock after <strong>30 minutes</strong>.</p>
      <p>If you did not attempt to log in, contact your administrator immediately.</p>
    `);
  }

  private buildWelcomeTemplate(name: string): string {
    return this.baseTemplate('Welcome to TempWorks', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Welcome to <strong>TempWorks</strong>! Your account is now active.</p>
      <p>Log in with your email and the password you set during activation.</p>
    `);
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
