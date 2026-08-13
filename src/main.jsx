import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Self-hosted: the app must not call a font CDN on every load. It would leak a
// request on each open and break the whole thing offline.
// Latin subsets only: the Cyrillic, Greek and Vietnamese ones would ship
// hundreds of kilobytes this app never displays.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
