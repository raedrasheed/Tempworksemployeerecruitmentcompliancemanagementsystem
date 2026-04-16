import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useBranding } from './hooks/useBranding';
import { BACKEND_URL } from './services/api';

function FaviconSync() {
  const branding = useBranding();

  useEffect(() => {
    const { logoUrl } = branding;
    if (!logoUrl) return;
    const href = logoUrl.startsWith('http') ? logoUrl : `${BACKEND_URL}${logoUrl}`;
    const link = document.getElementById('favicon') as HTMLLinkElement | null;
    if (link) link.href = href;
  }, [branding.logoUrl]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FaviconSync />
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
