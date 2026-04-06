declare module 'react-google-recaptcha-v3' {
  import * as React from 'react';

  export interface GoogleReCaptchaProviderProps {
    reCaptchaKey: string;
    language?: string;
    useRecaptchaNet?: boolean;
    useEnterprise?: boolean;
    scriptProps?: {
      nonce?: string;
      defer?: boolean;
      async?: boolean;
      appendTo?: 'head' | 'body';
      id?: string;
    };
    container?: {
      element?: string | HTMLElement;
      parameters?: {
        badge?: 'bottomright' | 'bottomleft' | 'inline';
        theme?: 'dark' | 'light';
        tabindex?: number;
      };
    };
    children?: React.ReactNode;
  }

  export function GoogleReCaptchaProvider(props: GoogleReCaptchaProviderProps): JSX.Element;

  export interface GoogleReCaptchaConsumerProps {
    children: (executeRecaptcha?: (action?: string) => Promise<string>) => JSX.Element;
  }

  export function GoogleReCaptchaConsumer(props: GoogleReCaptchaConsumerProps): JSX.Element;

  export interface UseGoogleReCaptchaReturn {
    executeRecaptcha?: (action?: string) => Promise<string>;
  }

  export function useGoogleReCaptcha(): UseGoogleReCaptchaReturn;

  export function withGoogleReCaptcha<T>(component: React.ComponentType<T>): React.ComponentType<T>;
}
