import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error logger for debugging on mobile
window.onerror = (message, source, lineno, colno, error) => {
  console.error("GLOBAL ERROR:", message, "at", source, lineno, colno, error);
  const fallback = document.getElementById('fallback-ui');
  if (fallback) {
    fallback.innerHTML = `<div style="color: red; padding: 20px;">
      <h3>CRITICAL ERROR</h3>
      <p>${message}</p>
      <small>Check browser console for details.</small>
    </div>`;
  }
};

const container = document.getElementById('root');
const fallback = document.getElementById('fallback-ui');

if (container) {
  if (fallback) fallback.style.display = 'none';
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
      