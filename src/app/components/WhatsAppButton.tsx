/**
 * WhatsApp contact action.
 * Thin anchor that opens a wa.me deep link in a new tab — works on
 * desktop (WhatsApp Web) and mobile (native app). Renders disabled
 * with a tooltip when the phone number can't be normalised.
 */
import { Button } from './ui/button';
import { buildWhatsAppUrl } from '../utils/whatsapp';

/** Official-style WhatsApp glyph. Kept as an inline SVG so we don't
 *  add a dependency just for a single icon. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.11 17.2c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.88-.78-1.48-1.75-1.66-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.12 3.24 5.14 4.55.72.3 1.28.48 1.72.62.72.23 1.37.2 1.89.12.58-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM16.03 5.33c-5.9 0-10.7 4.8-10.7 10.7 0 1.9.5 3.75 1.44 5.37L5.33 26.67l5.44-1.42c1.56.85 3.32 1.3 5.25 1.3 5.9 0 10.7-4.8 10.7-10.7s-4.8-10.72-10.7-10.72zm0 19.6c-1.67 0-3.32-.45-4.75-1.3l-.34-.2-3.23.85.86-3.15-.22-.34c-.93-1.48-1.42-3.18-1.42-4.95 0-5.13 4.17-9.3 9.1-9.3 2.5 0 4.82.97 6.58 2.73s2.72 4.08 2.72 6.58c0 5.13-4.17 9.3-9.3 9.3z" />
    </svg>
  );
}

type Size = 'sm' | 'icon';

interface Props {
  phone?: string | null;
  defaultCountryCode?: string | null;
  message?: string;
  /** Optional display label — e.g. "WhatsApp". When omitted only the icon is shown. */
  label?: string;
  size?: Size;
  className?: string;
}

export function WhatsAppButton({ phone, defaultCountryCode, message, label, size = 'sm', className }: Props) {
  const href = buildWhatsAppUrl(phone, { defaultCountryCode, message });
  const disabled = !href;
  const title = disabled
    ? 'No valid WhatsApp number available'
    : `Open WhatsApp chat${phone ? ` with ${phone}` : ''}`;

  const base = (
    <>
      <WhatsAppIcon className={size === 'icon' ? 'w-4 h-4' : 'w-4 h-4 mr-1.5'} />
      {label ? <span>{label}</span> : null}
    </>
  );

  if (disabled) {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size === 'icon' ? 'sm' : 'sm'}
        className={`text-muted-foreground ${className ?? ''}`}
        title={title}
        aria-label={title}
        disabled
      >
        {base}
      </Button>
    );
  }

  // Wrap an anchor so clicks use the native browser URL handler —
  // mobile will hand off to the WhatsApp app via the wa.me scheme.
  return (
    <Button
      type="button"
      asChild
      variant="ghost"
      size={size === 'icon' ? 'sm' : 'sm'}
      className={`text-[#25D366] hover:text-[#1ebc59] hover:bg-[#25D366]/10 ${className ?? ''}`}
      title={title}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {base}
      </a>
    </Button>
  );
}
