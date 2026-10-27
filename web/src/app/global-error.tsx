'use client';

import './globals.css';

/** Last-resort error screen, used when the root layout itself fails. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-md px-6 pt-24 text-center">
          <h1 className="text-ink text-2xl font-semibold tracking-tight">Dossier hit a problem</h1>
          <p className="text-muted mt-2">Your data is safe. Try again, and if it keeps happening, restart the app from the terminal.</p>
          <button type="button" onClick={reset} className="bg-brand mt-6 rounded-lg px-4 py-2 text-sm font-medium text-white">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
