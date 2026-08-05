# Embed

Run the img-man dashboard inside your own application, signed in as your own
user. No second login, no second password, no second user directory.

## How it works

Three pieces. Your API key stays on your server the whole time.

```
Browser                    Your server                  img-man
   |                            |                          |
   |  1. who am I? (session)    |                          |
   |--------------------------->|                          |
   |                            |  2. POST /api/v1/auth/token
   |                            |     Authorization: Bearer img_…
   |                            |     { email, name }      |
   |                            |------------------------->|
   |                            |                          | finds or creates
   |                            |   { accessToken }        | that user
   |                            |<-------------------------|
   |  3. { accessToken }        |                          |
   |<---------------------------|                          |
   |                                                       |
   |  4. <iframe src="…/embed/dashboard?token=…">          |
   |------------------------------------------------------>|
```

The token is short-lived and scoped to one user. The API key — which is *not*
short-lived and *not* scoped to one user — never leaves your server.

**An email img-man has not seen before is provisioned on first use**, with the
role set in **Settings → Integrations → Default role for new users**. Your
users never see an img-man login screen.

## Setup

### 1. Create an API key

In img-man: **Settings → API Keys → Create key**. Copy it — it is shown once.

### 2. Configure your server

```bash
IMGMAN_BASE_URL="https://img-man.example.com"
IMGMAN_API_KEY="img_…"
```

Both are server-side only. If your framework has a convention for exposing
variables to the browser (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`), **do not use
it for these**.

### 3. Add one endpoint to your server

It answers: *who is signed in right now, and what is their img-man token?*
Node/Express shown; the shape is the same anywhere.

```js
app.post('/api/imgman/token', async (req, res) => {
  // Whatever "the current user" means in your app.
  const user = await getSignedInUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  const response = await fetch(`${process.env.IMGMAN_BASE_URL}/api/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.IMGMAN_API_KEY}`,
    },
    body: JSON.stringify({
      email: user.email,
      name: user.name,
      expiresIn: '24h',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ error: data.error });
  }

  res.json({ accessToken: data.accessToken });
});
```

Take the identity from your **server-side session**, never from the request
body. If the browser can name the user, anyone can request a token as anyone.

### 4. Render the iframe

```jsx
function MediaLibrary() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    fetch('/api/imgman/token', { method: 'POST', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setToken(d.accessToken));
  }, []);

  if (!token) return <p>Loading…</p>;

  return (
    <iframe
      src={`https://img-man.example.com/embed/dashboard?token=${encodeURIComponent(token)}`}
      style={{ width: '100%', height: '80vh', border: 0 }}
      title="Media library"
    />
  );
}
```

That is the whole integration: two environment variables, one endpoint, one
iframe.

## Options

Query parameters on `/embed/dashboard`:

| Parameter | What it does |
| --- | --- |
| `token` | **Required.** The access token from step 3. |
| `folder` | Restrict the embed to one folder and its children. |
| `theme` | `light` or `dark`. |
| `brand` | Hex accent colour without the `#`, e.g. `brand=7C3AED`. |

## Restricting who gets provisioned

Under **Settings → Integrations**:

- **Default role for new users** — `editor` or `viewer`.
- **Allowed email domains** — when set, an address outside these domains is
  refused with `403` instead of being provisioned.

Note that the domain check only applies to users img-man has not seen. Adding
someone to the organization by other means — an invite, for example — makes
that check no longer apply to them, so do not treat an invite flow as a way to
work around a `403`.

## Troubleshooting

| Response | Cause | Fix |
| --- | --- | --- |
| `401` from your own endpoint | No signed-in session on the request. | Send session cookies (`credentials: 'include'`) or your own auth header. |
| `401` from img-man | API key wrong, revoked, or absent. | Check `IMGMAN_API_KEY`. Send it as `Authorization: Bearer img_…`. |
| `403` from img-man | Email is outside **Allowed email domains**. | Add the domain, or provision the user deliberately. |
| `404` from img-man | The API key does not belong to any organization. | Re-issue the key. |
| Blank iframe | Token missing, expired, or not URL-encoded. | `encodeURIComponent(token)`. Mint a fresh one. |
| Iframe refuses to load | Your origin is not allowed to frame img-man. | Add it under **Settings → Integrations → Allowed origins**. |

Check reachability from your server, not your laptop:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$IMGMAN_BASE_URL/api/health/live"
```

## The picker widget

There is a second, narrower surface at `/embed` — an asset picker that takes
`orgSlug` and `apiKey` as **query parameters**.

Prefer the token flow above. A URL parameter is not a secret: it lands in
browser history, `Referer` headers, and any proxy or access log along the way,
and an org API key is neither short-lived nor scoped to one user. Reach for
`/embed` only for an internal tool on a trusted network, and issue it a
read-scoped key.

## Related

- [API keys](api-keys.md)
- [Team & roles](team.md)
- [Public asset URLs](public-asset-url.md)
