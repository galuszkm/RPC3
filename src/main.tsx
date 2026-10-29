import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('rpc-viewer');
if (!root) throw new Error('Missing #rpc-viewer element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
