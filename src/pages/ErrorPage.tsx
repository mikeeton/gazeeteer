import { AlertTriangle, Home } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError() as { statusText?: string; message?: string };

  return (
    <main className="grid min-h-screen place-items-center bg-mist px-6 text-ink">
      <section className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-4 size-10 text-coral" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Something went off course</h1>
        <p className="mt-3 text-sm text-slate-600">
          {error?.statusText || error?.message || 'The page could not be loaded.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          <Home className="size-4" aria-hidden="true" />
          Home
        </Link>
      </section>
    </main>
  );
}
