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
