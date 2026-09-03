// Self-hosted fonts: the app must not call a font CDN on every load. It would
// leak a request on each open and break the whole thing offline.
// Latin subsets only: the Cyrillic, Greek and Vietnamese ones would ship
// hundreds of kilobytes this app never displays.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './globals.css';

export const metadata = {
  title: 'Ryder — AI document audit',
  icons: { icon: '/favicon.svg' },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
