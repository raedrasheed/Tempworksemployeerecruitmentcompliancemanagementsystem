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
    this.apiKey = this.config.get<string>('RESEND_API_KEY', '') || process.env.RESEND_API_KEY || '';
    this.from = this.config.get<string>('SMTP_FROM', 'TempWorks <onboarding@resend.dev>') || process.env.SMTP_FROM || 'TempWorks <onboarding@resend.dev>';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173') || process.env.FRONTEND_URL || 'http://localhost:5173';

    if (this.apiKey) {
      this.logger.log(`Email service ready (Resend API). Key: ${this.apiKey.substring(0, 8)}... FROM: ${this.from}`);
    } else {
      this.logger.error(
        'RESEND_API_KEY not found in environment! ' +
        `ConfigService returned: "${this.config.get('RESEND_API_KEY')}" | process.env: "${process.env.RESEND_API_KEY}". ` +
        'Emails will NOT be sent. Restart the backend after fixing .env',
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

  async sendTwoFactorCode(
    to: string,
    name: string,
    code: string,
    expiresInMinutes = 10,
    context: { ipAddress?: string } = {},
  ): Promise<void> {
    await this.sendMail(
      to,
      'Your TempWorks Verification Code',
      this.buildTwoFactorTemplate(name, code, expiresInMinutes, context),
    );
  }

  async sendPasswordChangedConfirmation(
    to: string,
    name: string,
    context: { changedAt?: Date; ipAddress?: string; initiator?: 'self' | 'reset' | 'admin' } = {},
    frontendUrl?: string,
  ): Promise<void> {
    const loginUrl = `${frontendUrl ?? this.frontendUrl}/login`;
    await this.sendMail(
      to,
      'Your TempWorks Password Was Changed',
      this.buildPasswordChangedTemplate(name, loginUrl, context),
    );
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

  async sendApplicationConfirmation(to: string, name: string, reference: string, appData: Record<string, any>): Promise<void> {
    await this.sendMail(to, `Application Received – Reference ${reference}`, this.buildApplicationConfirmationTemplate(name, reference, appData));
  }

  async sendNotificationEmail(
    to: string,
    name: string,
    title: string,
    message: string,
    eventType?: string,
  ): Promise<void> {
    await this.sendMail(to, title, this.buildNotificationTemplate(name, title, message, eventType));
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
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#333;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1a56db;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">TempWorks</h1>
    </div>
    <div style="padding:32px;line-height:1.6;">${body}</div>
    <div style="background:#f4f6f9;padding:20px 32px;font-size:12px;color:#666;text-align:center;">
      &copy; ${new Date().getFullYear()} TempWorks. Automated message — do not reply.<br/>
      If you did not request this, contact your administrator.
    </div>
  </div>
</body>
</html>`;
  }

  private btn(text: string, url: string): string {
    return `<a href="${url}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#1a56db;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">${text}</a>`;
  }

  private notice(text: string): string {
    return `<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:13px;">${text}</p>`;
  }

  private buildActivationTemplate(name: string, url: string): string {
    return this.baseTemplate('Activate Your Account', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Welcome to TempWorks! Your account has been created and is ready to activate.</p>
      <p style="margin:0 0 16px;">Click the button below to set your password and activate your account:</p>
      ${this.btn('Activate My Account', url)}
      ${this.notice('This link expires in <strong>60 minutes</strong>. Contact your admin to resend if it expires.')}
      <p style="margin:16px 0 8px;">If the button doesn't work, copy this link into your browser:</p>
      <p style="word-break:break-all;font-size:13px;"><a href="${url}" style="color:#1a56db;">${url}</a></p>
    `);
  }

  private buildPasswordResetTemplate(name: string, url: string, isAdminInitiated: boolean): string {
    const intro = isAdminInitiated
      ? 'An administrator has initiated a password reset for your account.'
      : 'We received a request to reset your TempWorks password.';
    return this.baseTemplate('Reset Your Password', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">${intro}</p>
      ${this.btn('Reset My Password', url)}
      ${this.notice('This link expires in <strong>60 minutes</strong>.')}
      <p style="margin:16px 0 8px;">If you didn't request this, ignore this email or contact your admin.</p>
      <p style="word-break:break-all;font-size:13px;"><a href="${url}" style="color:#1a56db;">${url}</a></p>
    `);
  }

  private buildTwoFactorTemplate(
    name: string,
    code: string,
    expiresInMinutes: number,
    context: { ipAddress?: string },
  ): string {
    const ip = context.ipAddress ? this.escape(context.ipAddress) : 'Unknown';
    return this.baseTemplate('Your Verification Code', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Use the verification code below to finish signing in. This code was requested from IP <strong>${ip}</strong>.</p>
      <div style="margin:20px 0;padding:18px 24px;background:#f0f5ff;border:1px solid #c7d7ff;border-radius:8px;text-align:center;">
        <div style="font-family:Consolas,Menlo,monospace;font-size:32px;letter-spacing:10px;color:#1a56db;font-weight:700;">${this.escape(code)}</div>
      </div>
      ${this.notice(`This code expires in <strong>${expiresInMinutes} minutes</strong>. Do not share it with anyone.`)}
      <p style="margin:16px 0 0;">If you did not try to sign in, ignore this email and consider changing your password.</p>
    `);
  }

  private buildPasswordChangedTemplate(
    name: string,
    loginUrl: string,
    context: { changedAt?: Date; ipAddress?: string; initiator?: 'self' | 'reset' | 'admin' },
  ): string {
    const when = (context.changedAt ?? new Date()).toUTCString();
    const ip = context.ipAddress ? this.escape(context.ipAddress) : 'Unknown';
    const initiatorLabel =
      context.initiator === 'reset' ? 'a password reset link'
      : context.initiator === 'admin' ? 'an administrator'
      : 'your account';
    return this.baseTemplate('Password Changed', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Your TempWorks password was changed successfully via ${initiatorLabel}.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">Changed at</td><td style="padding:6px 12px;color:#111827;">${when}</td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">IP address</td><td style="padding:6px 12px;color:#111827;">${ip}</td></tr>
      </table>
      <p style="margin:16px 0;">For security, all other active sessions have been signed out. Please log in again with your new password.</p>
      ${this.btn('Log In', loginUrl)}
      ${this.notice('If you did <strong>not</strong> make this change, contact your administrator immediately — your account may be compromised.')}
    `);
  }

  private buildPasswordExpiredTemplate(name: string, url: string): string {
    return this.baseTemplate('Password Expired', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Your TempWorks password has expired. Please log in and set a new one.</p>
      ${this.btn('Go to Login', url)}
      ${this.notice('Passwords expire every 30 days. Please choose a strong, unique password.')}
    `);
  }

  private buildAccountLockedTemplate(name: string): string {
    return this.baseTemplate('Account Temporarily Locked', `
      <p style="margin:0 0 16px;">Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Your TempWorks account has been <strong>temporarily locked</strong> due to multiple failed login attempts.</p>
      ${this.notice('It will automatically unlock after <strong>30 minutes</strong>.')}
      <p style="margin:0 0 16px;">If you did not attempt to log in, contact your administrator immediately.</p>
    `);
  }

  private buildWelcomeTemplate(name: string): string {
    return this.baseTemplate('Welcome to TempWorks', `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p>Welcome to <strong>TempWorks</strong>! Your account is now active.</p>
      <p>Log in with your email and the password you set during activation.</p>
    `);
  }

  private buildNotificationTemplate(name: string, title: string, message: string, eventType?: string): string {
    const iconMap: Record<string, string> = {
      DOCUMENT_EXPIRING_SOON:   '⚠️',
      DOCUMENT_EXPIRED:         '🔴',
      DOCUMENT_UPLOADED:        '📄',
      FINANCIAL_RECORD_CREATED: '💰',
      FINANCIAL_RECORD_UPDATED: '✏️',
      FINANCIAL_RECORD_DELETED: '🗑️',
      FINANCIAL_RECORD_DEDUCTED:'💸',
      FINANCIAL_HIGH_BALANCE:   '⚡',
    };
    const icon = eventType ? (iconMap[eventType] ?? '🔔') : '🔔';
    return this.baseTemplate(title, `
      <p>Hello <strong>${this.escape(name)}</strong>,</p>
      <p style="font-size:28px;margin:0 0 16px;">${icon}</p>
      <p><strong>${this.escape(title)}</strong></p>
      <p>${this.escape(message)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="font-size:12px;color:#888;">
        You received this because you have email notifications enabled for this event type.<br/>
        Manage your preferences in TempWorks under <strong>Notifications → Settings</strong>.
      </p>
    `);
  }

  private buildApplicationConfirmationTemplate(name: string, reference: string, d: Record<string, any>): string {
    const row = (label: string, value: string | undefined | null) =>
      value ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${this.escape(label)}</td><td style="padding:6px 12px;font-size:13px;color:#111827;">${this.escape(String(value))}</td></tr>` : '';

    const section = (title: string, rows: string) =>
      rows.trim() ? `<h3 style="margin:24px 0 6px;font-size:14px;color:#1a56db;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${title}</h3><table style="width:100%;border-collapse:collapse;">${rows}</table>` : '';

    const personal = section('Personal Information', [
      row('Full Name', [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')),
      row('Date of Birth', d.dateOfBirth),
      row('Gender', d.gender),
      row('Citizenship', d.citizenship),
      row('Country of Birth', d.countryOfBirth),
    ].join(''));

    const contact = section('Contact', [
      row('Email', d.email),
      row('Phone', d.phone ? `${d.phoneCode || ''} ${d.phone}`.trim() : undefined),
      row('Address', [d.address?.street, d.address?.city, d.address?.country].filter(Boolean).join(', ')),
    ].join(''));

    const driving = d.hasDrivingLicense === 'yes' ? section('Driving License', [
      row('License Number', d.licenseNumber),
      row('Categories', Array.isArray(d.licenseCategories) ? d.licenseCategories.join(', ') : d.licenseCategories),
      row('Issuing Country', d.licenseCountry),
      row('Experience Type', d.drivingExpType),
    ].join('')) : '';

    const edu = Array.isArray(d.education) && d.education.length
      ? section('Education', d.education.map((e: any) => row(e.level || 'Degree', [e.institution, e.country].filter(Boolean).join(' – '))).join(''))
      : '';

    const work = Array.isArray(d.workHistory) && d.workHistory.length
      ? section('Work Experience', d.workHistory.map((w: any) => row(w.jobTitle || 'Position', [w.company, w.country].filter(Boolean).join(' – '))).join(''))
      : '';

    const langs = Array.isArray(d.languages) && d.languages.length
      ? section('Languages', d.languages.map((l: any) => row(l.language, l.motherTongue ? 'Mother Tongue' : [l.speakingLevel, l.readingLevel].filter(Boolean).join(' / '))).join(''))
      : '';

    const skills = Array.isArray(d.skills) && d.skills.length
      ? section('Skills', d.skills.map((s: any) => row(s.skill, s.level || '—')).join(''))
      : '';

    const additional = section('Additional', [
      row('Preferred Start Date', d.preferredStartDate),
      row('Annual Salary Expectation (EUR)', d.salaryExpectation),
      row('Willing to Relocate', d.willingToRelocate ? 'Yes' : 'No'),
    ].join(''));

    return this.baseTemplate('Application Received', `
      <p>Dear <strong>${this.escape(name)}</strong>,</p>
      <p>Thank you for submitting your application. We have received it successfully and our team will review it shortly.</p>
      <div style="background:#f0f9ff;border-left:4px solid #1a56db;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#1e40af;">Your application reference number: <strong style="font-size:16px;">${this.escape(reference)}</strong></p>
      </div>
      <p>Below is a summary of the information you submitted:</p>
      ${personal}${contact}${driving}${edu}${work}${langs}${skills}${additional}
      <p style="margin-top:24px;">If you have any questions, please do not hesitate to contact us.</p>
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
