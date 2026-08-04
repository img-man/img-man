# Smart Albums

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

Smart Albums are auto-populated collections. You define a rule once (e.g. "all photos with the tag *product* taken last quarter"), and the album stays current as new assets are uploaded.

## When to use it

- Recurring marketing collections ("Q2 hero shots").
- Curated views by color, location, person, or AI tag.
- Driving an external feed via the API where you want a stable URL but a moving target.

## Step-by-step

1. Open **Smart Albums** in the sidebar.
2. Click **New Smart Album**.
3. Give it a name and (optionally) a cover.
4. Add one or more rules:
   - **Tags** include / exclude
   - **Colors** dominant color match
   - **Date range** uploaded or captured
   - **People** (if face clustering is enabled)
   - **Folder** scope
   - **Format / size**
5. Choose **Match all** (AND) or **Match any** (OR).
6. Save.

The grid view immediately shows the matching assets. You can share the album as you would any folder.

## Tips & limits

- Up to 25 smart albums per organization on the Free plan, unlimited on Pro.
- Rules re-evaluate continuously; new uploads appear within seconds.
- An asset can belong to many smart albums at once (membership is virtual).

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Album is empty | No assets match yet, or rule too narrow. | Loosen a rule or check tag spellings. |
| New uploads aren't appearing | AI tagging hasn't finished. | Wait a minute and refresh; tagging is async. |
| Rule references a person but no faces show up | Face clustering is disabled. | Enable it under Settings → AI. |

## Related

- [Assets](assets.md)
- [People Albums](people.md) — Browse and name face-clustered albums.
- [Sharing](sharing.md)
