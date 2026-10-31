import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { AppProvider } from './estado.jsx';
import './app.css';
import { iniciar } from '#plataforma';

createRoot(document.getElementById('raiz')).render(<AppProvider><App /></AppProvider>);

iniciar(); // Pages: registra o service worker; BeaconOS: nada
