# FAQ

> **Status:** DRAFT
> **Last updated:** 2026-04-26

## Storage

**Q: Where are my files stored?**
A: In Google Cloud Storage by default. You can connect your own GCP or AWS bucket (BYOC) on Pro and above.

**Q: Can I bring my own bucket?**
A: Yes. Settings → Storage → Connect bucket. We index in read-only mode first; nothing is moved without confirmation.

## Sharing

**Q: Is the asset URL public?**
A: Yes — anyone with the link can view it. For private use, generate a share link with a password and an expiry instead.

**Q: How do I resize an image without re-uploading?**
A: Append query params to the URL: `?w=400`, `?h=300`, `?format=webp`, `?q=85`, `?fit=cover`.

## AI

**Q: Do I need an OpenAI / Gemini account?**
A: No, the default plan uses our managed AI quota. To use your own keys (BYOK) and avoid our quota, go to Settings → AI Providers.

## Billing

**Q: Where do I see usage?**
A: The sidebar shows storage used, and Analytics shows bandwidth over time. img-man is self-hosted — there are no plans or quotas, only what you have consumed. See [Usage](features/usage.md).

## Self-hosting

**Q: Can I run img-man myself?**
A: Yes. The fastest evaluation path is `docker run --rm -p 3000:3000 imageman/imageman:latest`. If you want a generated env file and a separate MongoDB volume, use the Docker Compose path in [self-hosting.md](self-hosting.md) and [configuration.md](configuration.md).

**Q: What are the default first-time login credentials in bootstrap mode?**
A: Use `admin@img-man.com` as the email and `Admin@12345` as the password.

**Q: What should I do right after the first bootstrap login?**
A: Change the email and password immediately, then create an access token from Settings -> API Keys and use that token in your backend integration.
