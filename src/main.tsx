import '@fontsource/sora/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { hideSplash, isNative, setUpDurableStorage, watchKeyboard } from './native';
import './styles.css';

if (isNative) {
  document.documentElement.classList.add('native');
  // Stop iOS zooming in when a text field is focused; the app is laid out for the phone already.
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
  watchKeyboard();
}

// Offline support for the web app (the iPhone app ships its files already).
if (!isNative && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// In the iPhone app, saved data is restored from native storage before the first read.
setUpDurableStorage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  hideSplash();
});
