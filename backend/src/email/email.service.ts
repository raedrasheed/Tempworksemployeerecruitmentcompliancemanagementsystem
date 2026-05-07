import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { tEmail, interpolate, type EmailLocale } from './email-i18n';

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

  async sendActivationEmail(to: string, name: string, token: string, frontendUrl?: string, locale?: EmailLocale): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/activate?token=${token}`;
    const t = tEmail(locale, 'activation');
    await this.sendMail(to, interpolate(t.subject, { name }), this.buildActivationTemplate(name, url, locale));
  }

  async sendPasswordResetEmail(to: string, name: string, token: string, frontendUrl?: string, isAdminInitiated = false, locale?: EmailLocale): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/reset-password?token=${token}`;
    const t = tEmail(locale, isAdminInitiated ? 'passwordResetAdmin' : 'passwordReset');
    await this.sendMail(to, interpolate(t.subject, { name }), this.buildPasswordResetTemplate(name, url, isAdminInitiated, locale));
  }

  async sendTwoFactorCode(
    to: string,
    name: string,
    code: string,
    expiresInMinutes = 10,
    context: { ipAddress?: string } = {},
    locale?: EmailLocale,
  ): Promise<void> {
    const t = tEmail(locale, 'twoFactor');
    await this.sendMail(
      to,
      interpolate(t.subject, { name }),
      this.buildTwoFactorTemplate(name, code, expiresInMinutes, context, locale),
    );
  }

  async sendPasswordChangedConfirmation(
    to: string,
    name: string,
    context: { changedAt?: Date; ipAddress?: string; initiator?: 'self' | 'reset' | 'admin' } = {},
    frontendUrl?: string,
    locale?: EmailLocale,
  ): Promise<void> {
    const loginUrl = `${frontendUrl ?? this.frontendUrl}/login`;
    const t = tEmail(locale, 'passwordChanged');
    await this.sendMail(
      to,
      interpolate(t.subject, { name }),
      this.buildPasswordChangedTemplate(name, loginUrl, context, locale),
    );
  }

  async sendPasswordExpiredNotification(to: string, name: string, frontendUrl?: string, locale?: EmailLocale): Promise<void> {
    const url = `${frontendUrl ?? this.frontendUrl}/login`;
    const t = tEmail(locale, 'passwordExpired');
    await this.sendMail(to, interpolate(t.subject, { name }), this.buildPasswordExpiredTemplate(name, url, locale));
  }

  async sendAccountLockedEmail(to: string, name: string, locale?: EmailLocale): Promise<void> {
    const t = tEmail(locale, 'accountLocked');
    await this.sendMail(to, interpolate(t.subject, { name }), this.buildAccountLockedTemplate(name, locale));
  }

  async sendWelcomeEmail(to: string, name: string, locale?: EmailLocale): Promise<void> {
    const t = tEmail(locale, 'welcome');
    await this.sendMail(to, interpolate(t.subject, { name }), this.buildWelcomeTemplate(name, locale));
  }

  async sendApplicationConfirmation(to: string, name: string, reference: string, appData: Record<string, any>, locale?: EmailLocale): Promise<void> {
    const t = tEmail(locale, 'applicationConfirmation');
    await this.sendMail(to, interpolate(t.subject, { name, reference }), this.buildApplicationConfirmationTemplate(name, reference, appData, locale));
  }

  async sendNotificationEmail(
    to: string,
    name: string,
    title: string,
    message: string,
    eventType?: string,
    locale?: EmailLocale,
  ): Promise<void> {
    await this.sendMail(to, title, this.buildNotificationTemplate(name, title, message, eventType, locale));
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

  private baseTemplate(title: string, body: string, locale?: EmailLocale): string {
    const lc = locale ?? 'en';
    const dir = lc === 'ar' ? 'rtl' : 'ltr';
    return `<!DOCTYPE html>
<html lang="${lc}" dir="${dir}">
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
      &copy; ${new Date().getFullYear()} TempWorks
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

  private buildActivationTemplate(name: string, url: string, locale?: EmailLocale): string {
    const t = tEmail(locale, 'activation');
    return this.baseTemplate(t.heading ?? 'Activate Your Account', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${t.intro ?? ''}</p>
      ${this.btn(t.buttonLabel ?? 'Activate Account', url)}
      <p style="margin:16px 0 8px;">${t.fallbackLinkLabel ?? ''}</p>
      <p style="word-break:break-all;font-size:13px;"><a href="${url}" style="color:#1a56db;">${url}</a></p>
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildPasswordResetTemplate(name: string, url: string, isAdminInitiated: boolean, locale?: EmailLocale): string {
    const t = tEmail(locale, isAdminInitiated ? 'passwordResetAdmin' : 'passwordReset');
    return this.baseTemplate(t.heading ?? 'Reset Your Password', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${t.intro ?? ''}</p>
      ${this.btn(t.buttonLabel ?? 'Reset Password', url)}
      <p style="margin:16px 0 8px;">${t.fallbackLinkLabel ?? ''}</p>
      <p style="word-break:break-all;font-size:13px;"><a href="${url}" style="color:#1a56db;">${url}</a></p>
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildTwoFactorTemplate(
    name: string,
    code: string,
    expiresInMinutes: number,
    context: { ipAddress?: string },
    locale?: EmailLocale,
  ): string {
    const t = tEmail(locale, 'twoFactor');
    const ip = context.ipAddress ? this.escape(context.ipAddress) : 'Unknown';
    return this.baseTemplate(t.heading ?? 'Verification Code', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${interpolate(t.intro ?? '', { minutes: expiresInMinutes })}</p>
      <div style="margin:20px 0;padding:18px 24px;background:#f0f5ff;border:1px solid #c7d7ff;border-radius:8px;text-align:center;">
        <div style="font-family:Consolas,Menlo,monospace;font-size:32px;letter-spacing:10px;color:#1a56db;font-weight:700;">${this.escape(code)}</div>
      </div>
      <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">IP: ${ip}</p>
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildPasswordChangedTemplate(
    name: string,
    loginUrl: string,
    context: { changedAt?: Date; ipAddress?: string; initiator?: 'self' | 'reset' | 'admin' },
    locale?: EmailLocale,
  ): string {
    const t = tEmail(locale, 'passwordChanged');
    const when = (context.changedAt ?? new Date()).toUTCString();
    const ip = context.ipAddress ? this.escape(context.ipAddress) : 'Unknown';
    return this.baseTemplate(t.heading ?? 'Password Changed', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${t.intro ?? ''}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">${when}</td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280;white-space:nowrap;">IP: ${ip}</td></tr>
      </table>
      ${this.btn(t.buttonLabel ?? 'Sign in', loginUrl)}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildPasswordExpiredTemplate(name: string, url: string, locale?: EmailLocale): string {
    const t = tEmail(locale, 'passwordExpired');
    return this.baseTemplate(t.heading ?? 'Password Expired', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${t.intro ?? ''}</p>
      ${this.btn(t.buttonLabel ?? 'Sign in', url)}
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildAccountLockedTemplate(name: string, locale?: EmailLocale): string {
    const t = tEmail(locale, 'accountLocked');
    return this.baseTemplate(t.heading ?? 'Account Locked', `
      <p style="margin:0 0 16px;">${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="margin:0 0 16px;">${t.intro ?? ''}</p>
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildWelcomeTemplate(name: string, locale?: EmailLocale): string {
    const t = tEmail(locale, 'welcome');
    return this.baseTemplate(t.heading ?? 'Welcome', `
      <p>${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p>${t.intro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildNotificationTemplate(name: string, title: string, message: string, eventType?: string, locale?: EmailLocale): string {
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
    const t = tEmail(locale, 'notification');
    return this.baseTemplate(title, `
      <p>${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p style="font-size:28px;margin:0 0 16px;">${icon}</p>
      <p><strong>${this.escape(title)}</strong></p>
      <p>${this.escape(message)}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
  }

  private buildApplicationConfirmationTemplate(name: string, reference: string, d: Record<string, any>, locale?: EmailLocale): string {
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

    const t = tEmail(locale, 'applicationConfirmation');
    return this.baseTemplate(t.heading ?? 'Application Received', `
      <p>${interpolate(t.greeting ?? 'Hi {{name}},', { name: `<strong>${this.escape(name)}</strong>` })}</p>
      <p>${interpolate(t.intro ?? '', { reference: this.escape(reference) })}</p>
      <div style="background:#f0f9ff;border-left:4px solid #1a56db;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#1e40af;"><strong style="font-size:16px;">${this.escape(reference)}</strong></p>
      </div>
      ${personal}${contact}${driving}${edu}${work}${langs}${skills}${additional}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${t.outro ?? ''}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">${t.signoff ?? ''}</p>
    `, locale);
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
