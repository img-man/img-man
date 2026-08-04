# People Albums

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans (face clustering requires AI to be enabled)

## What it does

Groups photos by the people in them. img-man clusters faces automatically, and you can give each cluster a name so your library becomes searchable by person.

## When to use it

- Finding every photo that includes a specific teammate or family member.
- Building a Smart Album scoped to a person (e.g. "All photos of Alex from 2026").
- Verifying face-clustering quality before sharing an album externally.

## Requirements

Face clustering must be enabled. Go to **Settings → AI** and turn on **Face detection**. New uploads are analyzed automatically; existing photos are processed in the background (allow a few minutes for a large library).

## Step-by-step

### Browse people

1. Open **People** in the sidebar (under the Assets group).
2. Each card represents one detected person. The card shows a sample of thumbnails and a photo count.
3. Click a card to open the person's album — all photos img-man matched to that face.

### Name a person

1. On the People overview, click the **pencil** icon on a card.
2. Type the person's name and press **Enter** (or click **Save**).
3. The name appears on the card and is searchable from the main asset search bar and Smart Album rules.

### Pin a person

Click the **pin** icon to keep a person's card at the top of the list. Useful for frequently referenced team members or contacts.

### Correct a misidentified photo

1. Open the person's album.
2. If a photo does not belong, open it in the asset viewer and remove the face tag from the **Details** panel.
3. The photo drops out of the album on the next refresh.

## Tips & limits

- Face clustering groups by visual similarity, not by identity. If two people look similar, they may end up in the same cluster. Separate them manually from the person's album.
- A person cluster is created the first time a face is detected. The cluster grows as more matching photos are uploaded.
- Unnamed clusters still appear in the People overview. Name them to unlock Smart Album rules that target a person by name.
- Pinned people always appear first, regardless of photo count.
- Face data is stored only in your organization's database and is never sent to a third party. If you use BYOC storage, the face embeddings stay in your MongoDB database.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| No people cards appear | AI face detection is disabled or hasn't run yet. | Enable it under **Settings → AI**, then wait for the background job to finish. |
| A person is split across multiple cards | Face angle or lighting varied enough to produce two clusters. | Name both cards the same name; they will be merged in a future release. |
| Photos keep appearing in the wrong person's album | Clustering confidence is low for those faces. | Remove the misidentified photo from the album via the asset Details panel. |
| Saving a name fails | Network error. | Check your connection and try again; names are persisted immediately. |

## Related

- [Smart Albums](smart-albums.md) — use a named person as a Smart Album rule.
- [Assets](assets.md)
- [AI Studio](ai-studio.md) — other AI-powered features (background remove, upscale, generate).
