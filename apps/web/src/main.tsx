import '@fontsource-variable/lora';
import '@fontsource-variable/manrope';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { initInstallPrompt } from './features/pwa';
import { initTheme } from './shared/lib/theme';
import './shared/i18n';
import './styles.css';

// Событие установки может прийти до монтирования React-дерева.
initInstallPrompt();
// Тему применяем до первого рендера: иначе на тёмной системе мелькнёт светлый фон.
initTheme();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Не найден корневой элемент #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
