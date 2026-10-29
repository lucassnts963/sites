import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AppProvider } from './estado.jsx';
import './app.css';

createRoot(document.getElementById('raiz')).render(<AppProvider><App /></AppProvider>);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('../sw.js').catch(() => {});
