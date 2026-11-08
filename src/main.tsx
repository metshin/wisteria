import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/theme.css';
import './styles/animations.css';
import App from './App';
import { StoreProvider } from './store/store';
import { PomodoroProvider } from './components/Pomodoro';
import { SpinningDaisy } from './components/Decor';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider fallback={<SpinningDaisy size={60} label="Opening the blossoms…" />}>
      <PomodoroProvider>
        <App />
      </PomodoroProvider>
    </StoreProvider>
  </StrictMode>,
);
