import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-error">
      <span className="eyebrow">A QUIET CORNER</span>
      <h1 style={{ marginTop: 15 }}>Nothing to see here.</h1>
      <p className="muted">
        This page doesn’t exist, or this room isn’t available to your account.
      </p>
      <Link className="button" href="/dashboard">
        Back to your space
      </Link>
    </main>
  );
}
