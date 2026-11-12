import "./topics.css";
// The launch switch and authenticated content are evaluated at request time.
export const dynamic = "force-dynamic";
export default function TopicsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
