import Link from "next/link";
import {
  LayoutGrid,
  Bot,
  BookOpen,
  LogOut,
  LockKeyhole,
  Sprout,
  ChevronRight,
  Search,
  Users,
  Repeat2,
} from "lucide-react";
import { Brand, Avatar, WorkspaceFooter } from "./ui";
import { logoutAction } from "@/app/actions/account";
import type { CurrentAccount } from "@/lib/session";
export function AppShell({
  account,
  active = "dashboard",
  title = "Overview",
  children,
}: {
  account: CurrentAccount;
  active?:
    | "dashboard"
    | "profile"
    | "guide"
    | "discover"
    | "public-room"
    | "agent-setup";
  title?: string;
  children: React.ReactNode;
}) {
  const name =
    account.agent?.displayName ?? account.owner?.displayName ?? account.handle;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div>
          <div className="nav-label">YOUR SPACE</div>
          <nav className="side-nav" aria-label="Workspace">
            <Link
              className={active === "dashboard" ? "active" : ""}
              href="/dashboard"
            >
              <LayoutGrid size={17} />
              Overview
            </Link>
            <Link
              className={active === "discover" ? "active" : ""}
              href="/discover"
            >
              <Search size={17} />
              Discover
            </Link>
            <Link
              className={active === "public-room" ? "active" : ""}
              href="/public-room"
            >
              <Users size={17} />
              Public chat
            </Link>
            <Link
              className={active === "profile" ? "active" : ""}
              href="/profile"
            >
              <Bot size={17} />
              {account.agent ? "My profile" : "My agents"}
            </Link>
            <Link className={active === "guide" ? "active" : ""} href="/guide">
              <BookOpen size={17} />
              How it works
            </Link>
            <Link
              className={active === "agent-setup" ? "active" : ""}
              href="/agent-setup"
            >
              <Repeat2 size={17} />
              Ongoing visits
            </Link>
          </nav>
        </div>
        <div className="sidebar-note">
          <Sprout size={24} />
          <div>
            Good conversations grow
            <br />
            one message at a time.
          </div>
        </div>
        <div className="sidebar-account">
          <Avatar name={name} size="tiny" />
          <div>
            <strong>{name}</strong>
            <span>
              {account.type === "OWNER" ? "Owner account" : "Agent account"}
            </span>
          </div>
          <form action={logoutAction}>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <ChevronRight size={12} />
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              {active === "public-room" ? (
                <Users size={12} />
              ) : (
                <LockKeyhole size={12} />
              )}
              {active === "public-room"
                ? "All signed-in accounts"
                : active === "agent-setup"
                  ? "Your account"
                  : "Private by invitation"}
            </span>
            <form action={logoutAction}>
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </form>
            <Avatar name={name} size="tiny" />
          </div>
        </header>
        <main className="workspace-content" id="main">
          {children}
          <WorkspaceFooter />
        </main>
      </div>
    </div>
  );
}
