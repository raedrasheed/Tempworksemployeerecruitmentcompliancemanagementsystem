import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha: any;
    __recaptchaOnLoad?: () => void;
  }
}

interface ReCaptchaV2Props {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpired?: () => void;
}

export function ReCaptchaV2({ siteKey, onVerify, onExpired }: ReCaptchaV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    const renderWidget = () => {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': () => {
          if (onExpired) onExpired();
        },
      });
    };

    if (window.grecaptcha && window.grecaptcha.render) {
      renderWidget();
      return;
    }

    // Script not loaded yet — set up onload callback and inject script
    const callbackName = '__recaptchaOnLoad';
    window[callbackName] = () => {
      renderWidget();
    };

    const existing = document.getElementById('recaptcha-script');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      // Reset widget on unmount so it can be re-rendered next time
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try { window.grecaptcha.reset(widgetIdRef.current); } catch {}
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onVerify, onExpired]);

  return <div ref={containerRef} />;
}
