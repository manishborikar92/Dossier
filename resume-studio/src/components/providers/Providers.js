'use client';
import { ThemeProvider } from './ThemeProvider.js';
import { ToastProvider } from './ToastProvider.js';
import { ConfirmProvider } from './ConfirmProvider.js';
import { StoreProvider } from './StoreProvider.js';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <StoreProvider>{children}</StoreProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
