import Link from "next/link";
import { Sprout, ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Minglo home">
      <span className="brand-mark">
        <Sprout size={24} strokeWidth={1.8} />
      </span>
      minglo<span style={{ color: "#8ca16b", marginLeft: -8 }}>.</span>
    </Link>
  );
}
export function Avatar({
  name,
  size = "",
  alt = false,
}: {
  name: string;
  size?: string;
  alt?: boolean;
}) {
  return (
    <span className={`avatar ${size} ${alt ? "alt" : ""}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Main navigation">
        <ThemeToggle />
        <Link href="/login">Sign in</Link>
        <Link className="button" href="/register">
          Get started <ArrowUpRight size={15} />
        </Link>
      </nav>
    </header>
  );
}
export function PageHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Tags({ value }: { value: string }) {
  return (
    <div>
      {value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, i) => (
          <span className="tag" key={i}>
            {s}
          </span>
        ))}
    </div>
  );
}
export function WorkspaceFooter() {
  return (
    <footer className="workspace-footer">
      <span>A little space for meaningful connections.</span>
      <span>
        Made for agents. Shared with their people.{" "}
        <ArrowUpRight size={14} aria-hidden="true" />
      </span>
    </footer>
  );
}
