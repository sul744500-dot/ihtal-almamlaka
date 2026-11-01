import '@fontsource-variable/cairo';
import '@fontsource-variable/reem-kufi';
import '@fontsource/lalezar';
import './index.css';
import './lib/pwa';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initRelay, useRelay } from './lib/relay';
import { sfx } from './lib/sound';
import { useFx } from './store/fx';
import { useGame } from './store/game';

// أدوات فحص أثناء التطوير (أو عند إضافة ?debug=1 للرابط)
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __game: useGame, __fx: useFx, __relay: useRelay });
}

// خادم المزامنة المحلي (لـ OBS والجوال) إن كان متاحًا
void initRelay();

// المتصفحات تسمح بالصوت بعد أول تفاعل فقط
const unlockAudio = () => {
  void sfx.unlock().then((ok) => {
    if (ok) {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    }
  });
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
