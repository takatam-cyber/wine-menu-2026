import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { WineProvider } from './lib/WineContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WineProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WineProvider>
  </StrictMode>,
);
