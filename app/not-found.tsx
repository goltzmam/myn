import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page">
      <h1>A little off the path.</h1>
      <p>This page is unavailable.</p>
      <Link href="/">Back to myn.</Link>
    </main>
  );
}
