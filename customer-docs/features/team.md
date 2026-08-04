# Team & Roles

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans (Advanced folder-level access rules are Pro+)

## What it does

Lets you invite colleagues to your img-man organization, assign them a role, and optionally restrict them to specific folders or dashboard sections.

## When to use it

- Onboarding a new designer who should only access certain folders.
- Granting a client view-only access to a shared asset library.
- Promoting a team member to admin after a role change.
- Revoking access when someone leaves the team.

## Roles

| Role | What they can do |
|---|---|
| **Owner** | Full control: billing, members, settings, delete org. One per org. |
| **Admin** | Everything except billing and transferring ownership. Can manage members below admin level. |
| **Editor** | Upload, edit, and delete assets. Cannot invite members or change settings. |
| **Viewer** | Read-only access to the library and shared assets. Cannot upload or delete. |

## Step-by-step

### Invite a member

1. Open **Settings → Team** in the sidebar.
2. Click **Invite member**.
3. Enter the person's email address.
4. Choose their **Role** (Admin / Editor / Viewer).
5. Optionally add **Folder access** — restrict them to one or more folders instead of the whole library.
6. Click **Send invite**. The invite link is valid for 7 days.

### Change a member's role

1. In the Team list, click the **⋯** (more) menu on the member's row.
2. Choose **Change role** and pick the new role.
3. The change takes effect immediately.

### Restrict a member to specific dashboard sections

1. Click the member's row to expand their details.
2. Under **Section access**, toggle off any dashboard sections they should not see (AI Studio, Designs, Shares, etc.).
3. Save. The sections become invisible to that member on their next page load.

### Revoke access

1. Click **⋯** on the member's row.
2. Choose **Remove member**. Confirm.
3. The member is immediately signed out and cannot access the org.

### Cancel a pending invite

1. Find the pending member (marked with a **clock** badge).
2. Click **⋯ → Remove** to invalidate the invite link.

## Tips & limits

- An Owner cannot be removed; transfer ownership from **Settings → General** first.
- Admins can invite Editors and Viewers, but not other Admins.
- Folder-level access is additive: a member with no folder rules sees the whole library; a member with folder rules sees only those folders.
- Invites expire after 7 days. Re-invite if the link expires.
- All member changes are logged in the audit trail under `member.invited`, `member.role.changed`, and `member.removed`.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Invite email not received | Spam filter or wrong email. | Check spam; re-send the invite from **⋯ → Resend**. |
| Cannot promote a member to admin | Your role is Editor or Viewer. | Only Owners and Admins can change roles. |
| Member still has access after removal | Session cache. | The member will be signed out on their next request, usually within seconds. |
| Folder access changes not taking effect | Browser cache. | Ask the member to reload the page. |

## Related

- [API keys](api-keys.md) — service accounts that act on behalf of the org.
- [Audit log](../audit-log.md) — history of all membership changes.
- [Sharing](sharing.md) — share individual assets without adding a team member.
