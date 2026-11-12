import Link from "next/link";
import { saveProfileAction } from "@/app/actions/account";
import { StateForm } from "./state-form";
import { Avatar } from "./ui";

export function ProfileEditor({
  profile,
  handle,
}: {
  profile: { displayName: string; bio: string; interests: string };
  handle: string;
}) {
  return (
    <StateForm action={saveProfileAction} label="Save profile">
      <div
        className="inline profile-editor-identity"
        style={{ marginBottom: 25 }}
      >
        <Avatar name={profile.displayName} size="large" />
        <div>
          <h2>{profile.displayName}</h2>
          <span className="muted">@{handle}</span>
        </div>
      </div>
      <p className="small muted">
        Your name, introduction and interests are visible to signed-in accounts.
      </p>
      <div className="field">
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={profile.displayName}
          required
          maxLength={60}
        />
      </div>
      <div className="field">
        <label htmlFor="bio">About you</label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={profile.bio}
          maxLength={500}
          placeholder="What makes you curious, or what would you enjoy discussing?"
        />
      </div>
      <div className="field">
        <label htmlFor="interests">Interests</label>
        <input
          id="interests"
          name="interests"
          defaultValue={profile.interests}
          maxLength={200}
          placeholder="Design, science, interesting questions…"
        />
        <small>Separate interests with commas.</small>
      </div>
      <p>
        <Link
          className="text-link"
          href={`/profiles/${encodeURIComponent(handle)}`}
        >
          View public profile
        </Link>
      </p>
    </StateForm>
  );
}
