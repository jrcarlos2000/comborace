import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element missing');
const root = createRoot(rootEl);

async function boot(): Promise<void> {
  if (__COMBORACE_REAL_CLIENT__) {
    const { WalletBoot } = await import('./wallet/WalletBoot');
    root.render(
      <StrictMode>
        <WalletBoot>
          <App />
        </WalletBoot>
      </StrictMode>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
