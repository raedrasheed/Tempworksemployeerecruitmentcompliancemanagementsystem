import { useState, useEffect } from 'react';
import { API_URL } from '../services/api';

export interface Branding {
  companyName: string;
  logoUrl?: string;
}

const DEFAULT: Branding = { companyName: 'TempWorks Europe' };

let cache: Branding | null = null;
let inflight: Promise<Branding> | null = null;

async function fetchBranding(): Promise<Branding> {
  try {
    const res = await fetch(`${API_URL}/settings/branding`);
    if (!res.ok) return DEFAULT;
    const data = await res.json();
    return {
      companyName: data.companyName || DEFAULT.companyName,
      logoUrl: data.logoUrl,
    };
  } catch {
    return DEFAULT;
  }
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cache ?? DEFAULT);

  useEffect(() => {
    if (cache) {
      setBranding(cache);
      return;
    }
    if (!inflight) {
      inflight = fetchBranding().then(b => { cache = b; return b; });
    }
    inflight.then(setBranding);
  }, []);

  return branding;
}

export function invalidateBrandingCache() {
  cache = null;
  inflight = null;
}
