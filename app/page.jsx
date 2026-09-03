'use client';

import dynamic from 'next/dynamic';

// The whole review UI is client-side: it parses the file in the browser with
// pdfjs, mammoth and tesseract, none of which survive a server render. Loading
// it with `ssr: false` is what replaces the old Vite entry point.
const App = dynamic(() => import('../src/App.jsx'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Chargement…
    </div>
  ),
});

export default function Page() {
  return <App />;
}
