import { AlertTriangle, Home } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError() as { statusText?: string; message?: string };

  return (
    <main className="grid min-h-screen place-items-center bg-mist px-6 text-ink">
      <section className="glass-panel max-w-md p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 size-10 text-coral" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Something went off course</h1>
        <p className="mt-3 text-sm text-slate-600">
          {error?.statusText || error?.message || 'The page could not be loaded.'}
        </p>
        <Link
          to="/"
          className="ui-button ui-button-primary mt-6"
        >
          <Home className="size-4" aria-hidden="true" />
          Home
        </Link>
      </section>
    </main>
  );
}
