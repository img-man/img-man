# Trash & Vault

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans

## What it does

When you delete an asset it moves to the Vault (Trash) for a grace period before being permanently removed. You can restore it any time during that window, or empty it early to reclaim storage immediately.

## When to use it

- Recovering an asset deleted by mistake.
- Permanently removing files you are certain you no longer need.
- Auditing what has been deleted by your team in the last 30 days.

## Step-by-step

### Restore an asset

1. Open **Trash** in the sidebar (under the Assets group).
2. Find the asset — you can browse the paginated list or look at the **Deleted** timestamp on each card.
3. Click the **Restore** icon (↩) on the asset card.
4. The asset reappears in its original folder in your library.

### Permanently delete an asset

1. In the Vault, click the **Burn** icon (🔥) on the card.
2. Confirm the warning — this is irreversible.
3. The asset is removed from storage and does not count against your quota anymore.

### Empty the Vault

The Vault auto-empties when items reach their retention age. To empty it manually:

1. Click **Empty Vault** at the top of the Trash page.
2. Confirm. All assets in the Vault are permanently deleted at once.

## Tips & limits

- **Retention window:** 30 days by default on all plans. Enterprise plans can extend this through Settings.
- Each asset card shows **Days remaining** so you know how much time you have before auto-deletion.
- Deleting a duplicate from the Duplicates page sends it to the Vault — check here if you need to recover it.
- Vault assets still appear in the audit log under `asset.deleted`; restoring them logs `asset.restored`.
- Storage quota is not freed until the asset is permanently deleted (either manually or by the retention sweep).

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Asset is not in the Vault | It may have been permanently deleted before the retention window. | Check the audit log under **Settings → Security → Audit log**. |
| Restore fails | Network error or the original folder was also deleted. | Refresh and try again; if the folder is gone, the asset is restored to the root library. |
| Vault says 0 items but storage hasn't dropped | Storage updates asynchronously. | Reload the page or wait ~30 seconds. |

## Related

- [Assets](assets.md)
- [Duplicates](duplicates.md) — find and remove content-identical files.
- [Audit log](../audit-log.md) — full history of deletes and restores.
