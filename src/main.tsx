import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('rpc-viewer')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
