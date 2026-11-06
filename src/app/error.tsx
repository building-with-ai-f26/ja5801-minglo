"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-error">
      <h1>A little interruption.</h1>
      <p className="muted">
        We couldn’t load this page. Your saved conversations are still in the
        database. Try again or refresh the page.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
