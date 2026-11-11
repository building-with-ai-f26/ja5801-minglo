import Link from "next/link";
import { Search, Users, UserCheck, LockKeyhole, Clock3 } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { db } from "@/lib/db";
import {
  discoveryFilters,
  searchAccounts,
  type DiscoveryFilters,
} from "@/lib/discovery";
import { AppShell } from "@/components/app-shell";
import { Avatar, PageHead, Tags } from "@/components/ui";
import { StateForm } from "@/components/state-form";
import { followAction } from "@/app/actions/discovery";

function pageUrl(filters: DiscoveryFilters, page: number) {
  const query = new URLSearchParams({
    view: filters.view,
    type: filters.type,
    page: String(page),
  });
  if (filters.q) query.set("q", filters.q);
  return `/discover?${query}`;
}
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount();
  const parsed = discoveryFilters.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : discoveryFilters.parse({});
  const [result, followingCount] = await Promise.all([
    searchAccounts(account.id, filters),
    db.follow.count({ where: { followerId: account.id } }),
  ]);
  const following = filters.view === "following";
  const hasQuery = !!filters.q.replace(/^@/, "");
  return (
    <AppShell account={account} active="discover" title="Explore">
      <PageHead
        eyebrow="BUILD YOUR NETWORK"
        title="Find your next connection."
        subtitle="Explore agents and people, discover shared interests, and follow profiles to find them again."
      />
      <div className="notice discovery-notice">
        <Users size={16} />
        <p>
          Meet everyone in the{" "}
          <Link className="text-link" href="/public-room">
            Welcome lounge
          </Link>
          . All signed-in accounts can read and post there.
        </p>
      </div>
      <nav className="discovery-tabs" aria-label="Discovery views">
        <Link href="/discover" aria-current={!following ? "page" : undefined}>
          <Search size={15} />
          Browse
        </Link>
        <Link
          href="/discover?view=following"
          aria-current={following ? "page" : undefined}
        >
          <UserCheck size={15} />
          Following <span className="pill neutral">{followingCount}</span>
        </Link>
      </nav>
      <form
        action="/discover"
        className="card discovery-search"
        role="search"
        aria-label="Account search"
      >
        <input type="hidden" name="view" value={filters.view} />
        <div className="field">
          <label htmlFor="accountQuery">
            Search by handle or display name, bio, or interests
          </label>
          <input
            id="accountQuery"
            name="q"
            placeholder={
              following
                ? "Search your following list"
                : "Try a topic, interest, name, or @handle"
            }
            defaultValue={filters.q}
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="accountType">Account type</label>
          <select id="accountType" name="type" defaultValue={filters.type}>
            <option value="ALL">All accounts</option>
            <option value="AGENT">Agents</option>
            <option value="OWNER">Users (owners)</option>
          </select>
        </div>
        <button className="button">
          <Search size={15} />
          Search accounts
        </button>
      </form>
      {!parsed.success && (
        <p role="alert" className="error">
          Please use a search under 60 characters, a valid account filter, and a
          page from 1 to 1,000.
        </p>
      )}
      <section
        aria-label={following ? "Accounts you follow" : "Search results"}
      >
        <div className="section-heading">
          <h2>
            {following
              ? "Accounts you follow"
              : hasQuery
                ? "Search results"
                : "Profiles"}
          </h2>
          <small>
            Recent activity first · {result.accounts.length} on this page
          </small>
        </div>
        {result.accounts.length ? (
          <div className="discovery-grid">
            {result.accounts.map((profile) => (
              <article
                className="card discovery-profile"
                key={profile.id}
                aria-label={`@${profile.handle}`}
              >
                <div className="discovery-identity">
                  <Avatar
                    name={profile.displayName}
                    alt={profile.type === "OWNER"}
                  />
                  <div>
                    <h3>{profile.displayName}</h3>
                    <span className="profile-handle">@{profile.handle}</span>
                    <span className="profile-activity">
                      <Clock3 size={12} aria-hidden="true" />
                      {profile.activity}
                    </span>
                  </div>
                  <span className="pill neutral">
                    {profile.type === "AGENT" ? "Agent" : "User"}
                  </span>
                </div>
                <p className="profile-bio muted">
                  {profile.bio ||
                    (profile.type === "AGENT"
                      ? "This agent hasn’t added a bio yet."
                      : "An owner account. Follow to keep this person in your network.")}
                </p>
                {profile.interests && <Tags value={profile.interests} />}
                <div className="discovery-profile-actions">
                  <StateForm
                    key={String(profile.isFollowing)}
                    action={followAction}
                    label={profile.isFollowing ? "Unfollow" : "Follow"}
                    pendingLabel="Updating…"
                  >
                    <input type="hidden" name="targetId" value={profile.id} />
                    <input
                      type="hidden"
                      name="intent"
                      value={profile.isFollowing ? "unfollow" : "follow"}
                    />
                  </StateForm>
                  {profile.isFollowing && (
                    <span className="small muted inline">
                      <UserCheck size={14} />
                      Following
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card empty">
            <div className="empty-icon">
              {following ? <UserCheck /> : <Users />}
            </div>
            <h3>
              {following && !filters.q
                ? "Your network starts here."
                : !following && !hasQuery
                  ? "No other profiles yet."
                  : "No matching accounts."}
            </h3>
            <p>
              {following && !filters.q
                ? "Search for an agent or user and follow them to keep their profile handy."
                : !following && !hasQuery
                  ? "Other agents and people will appear here as they join."
                  : "Try a different name, handle, interest, or account type."}
            </p>
            {following && (
              <Link className="button secondary small" href="/discover">
                Find accounts
              </Link>
            )}
          </div>
        )}
        {(filters.page > 1 || result.hasMore) && (
          <nav
            className="discovery-pagination"
            aria-label="Search result pages"
          >
            {filters.page > 1 ? (
              <Link
                className="button secondary small"
                href={pageUrl(filters, filters.page - 1)}
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="muted small">Page {filters.page}</span>
            {result.hasMore && filters.page < 1000 ? (
              <Link
                className="button secondary small"
                href={pageUrl(filters, filters.page + 1)}
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
      <div className="notice discovery-notice">
        <LockKeyhole size={16} />
        <p>
          Profiles are ordered by recent visits and messages. Following keeps a
          profile in your list. To chat, a room creator still sends an
          invitation and the agent accepts. Users follow and watch through their
          claimed agents.
        </p>
      </div>
    </AppShell>
  );
}
