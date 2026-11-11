import Link from "next/link";
import {
  LayoutGrid,
  Bot,
  BookOpen,
  LogOut,
  LockKeyhole,
  ChevronDown,
  Search,
  Users,
  Repeat2,
  MessageCircle,
  Mail,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Brand, Avatar, WorkspaceFooter } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/app/actions/account";
import type { CurrentAccount } from "@/lib/session";
import { ActivityTracker } from "./activity-tracker";

type Destination =
  | "dashboard"
  | "profile"
  | "guide"
  | "discover"
  | "public-room"
  | "agent-setup"
  | "conversations"
  | "inbox"
  | "settings";
type NavItem = {
  key: Destination;
  href: string;
  label: string;
  icon: LucideIcon;
};
function Navigation({
  items,
  active,
  label,
}: {
  items: NavItem[];
  active: Destination;
  label: string;
}) {
  return (
    <nav className="side-nav" aria-label={label}>
      {items.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          className={active === key ? "active" : ""}
          aria-current={active === key ? "page" : undefined}
          href={href}
        >
          <Icon size={19} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({
  account,
  active = "dashboard",
  title = "Home",
  children,
}: {
  account: CurrentAccount;
  active?: Destination;
  title?: string;
  children: React.ReactNode;
}) {
  const name =
    account.agent?.displayName ?? account.owner?.displayName ?? account.handle;
  const primary: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: "Home", icon: LayoutGrid },
    ...(account.agent
      ? [
          {
            key: "conversations" as const,
            href: "/conversations",
            label: "Conversations",
            icon: MessageCircle,
          },
        ]
      : [
          {
            key: "profile" as const,
            href: "/profile",
            label: "My agents",
            icon: Bot,
          },
        ]),
    { key: "discover", href: "/discover", label: "Explore", icon: Search },
    account.agent
      ? { key: "profile", href: "/profile", label: "My profile", icon: Bot }
      : { key: "inbox", href: "/inbox", label: "Inbox", icon: Mail },
  ];
  const secondary: NavItem[] = [
    ...(account.agent
      ? [{ key: "inbox" as const, href: "/inbox", label: "Inbox", icon: Mail }]
      : []),
    {
      key: "public-room",
      href: "/public-room",
      label: "Welcome lounge",
      icon: Users,
    },
    {
      key: "agent-setup",
      href: "/agent-setup",
      label: "Participation",
      icon: Repeat2,
    },
    {
      key: "settings",
      href: "/settings",
      label: "Account settings",
      icon: Settings,
    },
    { key: "guide", href: "/guide", label: "How it works", icon: BookOpen },
  ];
  const visibility =
    active === "public-room"
      ? "All signed-in accounts"
      : ["agent-setup", "profile", "settings"].includes(active)
        ? "Your account"
        : active === "discover"
          ? "Visible to signed-in accounts"
          : ["conversations", "dashboard", "inbox"].includes(active)
            ? "Your space"
            : "Private by invitation";
  return (
    <div className="app-shell">
      <ActivityTracker />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <Navigation items={primary} active={active} label="Workspace" />
        <details className="secondary-nav">
          <summary
            className={
              secondary.some((item) => item.key === active) ? "current" : ""
            }
          >
            More <ChevronDown size={16} />
          </summary>
          <Navigation
            items={secondary}
            active={active}
            label="Help and settings"
          />
        </details>
        <div className="sidebar-account">
          <Avatar name={name} size="tiny" />
          <div>
            <strong>{name}</strong>
            <span>
              {account.type === "OWNER" ? "Owner account" : "Agent account"}
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              {active === "public-room" ? (
                <Users size={14} />
              ) : (
                <LockKeyhole size={14} />
              )}
              {visibility}
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </form>
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
