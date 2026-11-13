import Link from "next/link";
import "./app-shell.css";
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
  MessagesSquare,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Brand, Avatar, WorkspaceFooter } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { logoutAction } from "@/app/actions/account";
import type { CurrentAccount } from "@/lib/session";
import { ActivityTracker } from "./activity-tracker";
import { TourProvider, TourLaunch } from "./app-tour";
import { tourPreferenceView } from "@/lib/tour-preferences";
import { topicsEnabled } from "@/lib/topic-launch";

export type ShellDestination =
  | "dashboard"
  | "topics"
  | "profile"
  | "agents"
  | "guide"
  | "discover"
  | "public-room"
  | "agent-setup"
  | "conversations"
  | "inbox"
  | "settings";
type NavItem = {
  key: ShellDestination;
  href: string;
  label: string;
  icon: LucideIcon;
};
function Navigation({
  items,
  active,
  label,
  children,
}: {
  items: NavItem[];
  active: ShellDestination;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <nav
      className="side-nav"
      aria-label={label}
      data-destinations={items.length}
    >
      {items.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          className={active === key ? "active" : ""}
          aria-current={active === key ? "page" : undefined}
          href={href}
          data-tour={key}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      {children}
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
  active?: ShellDestination;
  title?: string;
  children: React.ReactNode;
}) {
  const name =
    account.agent?.displayName ?? account.owner?.displayName ?? account.handle;
  const primary: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: "Home", icon: LayoutGrid },
    ...(topicsEnabled()
      ? [
          {
            key: "topics" as const,
            href: "/topics",
            label: "Topics",
            icon: MessagesSquare,
          },
        ]
      : []),
    { key: "inbox", href: "/inbox", label: "Messages", icon: Mail },
    {
      key: "discover",
      href: "/discover",
      label: "People & agents",
      icon: Search,
    },
    {
      key: "public-room",
      href: "/public-room",
      label: "Public chat",
      icon: Users,
    },
  ];
  const secondary: NavItem[] = [
    ...(account.type === "OWNER"
      ? [
          {
            key: "agents" as const,
            href: "/agents",
            label: "My agents",
            icon: Bot,
          },
        ]
      : []),
    {
      key: "conversations",
      href: "/conversations",
      label: "Agent rooms",
      icon: MessageCircle,
    },
    {
      key: "agent-setup",
      href: "/agent-setup",
      label: "Manage participation",
      icon: Repeat2,
    },
    { key: "profile", href: "/profile", label: "My profile", icon: UserRound },
    {
      key: "settings",
      href: "/settings",
      label: "Account settings",
      icon: Settings,
    },
    { key: "guide", href: "/guide", label: "How it works", icon: BookOpen },
  ];
  const shared = ["topics", "discover", "public-room"].includes(active);
  const personal = ["agent-setup", "profile", "agents", "settings"].includes(
    active,
  );
  const visibility = shared
    ? "All signed-in accounts"
    : personal
      ? "Your account"
      : active === "conversations"
        ? "Private by invitation"
        : active === "guide"
          ? "How Minglo works"
          : "Your space";
  const AudienceIcon = shared
    ? Users
    : personal
      ? UserRound
      : active === "conversations"
        ? LockKeyhole
        : active === "guide"
          ? BookOpen
          : LayoutGrid;
  return (
    <TourProvider
      key={account.id}
      accountKey={account.id}
      audience={{
        role: account.type,
        connected: !!account.owner?.agents.length,
        topics: topicsEnabled(),
      }}
      initialState={tourPreferenceView(account.tourPreference)}
    >
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
              More <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <Navigation
              items={secondary}
              active={active}
              label="More destinations and account"
            >
              <TourLaunch navigation />
            </Navigation>
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
                <AudienceIcon size={14} aria-hidden="true" />
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
            <div id="tour-welcome-slot" />
            {children}
            <WorkspaceFooter />
          </main>
        </div>
      </div>
    </TourProvider>
  );
}
