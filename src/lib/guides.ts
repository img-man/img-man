// SPDX-License-Identifier: Apache-2.0
/* ─── Built-in Setup Guides ───────────────────────────
 * Pre-written documentation for customers to understand
 * how to use ImageMan: API, white-labeling, transforms, etc.
 * ──────────────────────────────────────────────────── */

export interface Guide {
 slug: string;
 title: string;
 description: string;
 category: string;
 content: string;
}

export interface GuideCategory {
 name: string;
 description: string;
 guides: Guide[];
}

/* ─── Guide Content ──────────────────────────────────── */

const GUIDE_CONTENT: Record<string, string> = {
 'quick-start': `
## Welcome to ImageMan

img-man is your all-in-one image management and design platform. This guide will walk you through the essential steps to get started — upload your first image, organize with folders, create a design, and share with your team.

---

### Step 1: Upload Your First Image

Navigate to the **Assets** page from the sidebar. You can upload images by:

- **Drag & Drop** — Drag files directly onto the upload area
- **Click to Browse** — Click the Upload button to select files from your computer
- **Paste** — Copy an image and paste it (\`Ctrl+V\` / \`⌘+V\`)

> **Supported formats:** JPEG, PNG, WebP, GIF, SVG, AVIF, and TIFF. Maximum file size depends on your plan.

Once uploaded, img-man automatically generates a thumbnail, extracts metadata (dimensions, size, format), and — if AI auto-tagging is enabled — applies intelligent tags using Google Vertex AI Vision.

---

### Step 2: Organize with Folders

Create folders to keep your assets organized:

1. Click the **New Folder** button in the sidebar or asset grid
2. Name your folder (e.g., "Marketing Assets", "Product Photos")
3. Drag assets into folders, or right-click and use the context menu to move

| Feature | Description |
|---------|-------------|
| **Nested Folders** | Create unlimited folder depth for complex hierarchies |
| **Drag & Drop** | Move assets between folders by dragging |
| **Context Menu** | Right-click any folder to rename, create subfolders, share, or delete |
| **Breadcrumbs** | Navigate your folder tree using the breadcrumb trail |

---

### Step 3: Use the Design Studio

Open the **Design Studio** to create custom graphics:

1. Go to **Designs** in the sidebar
2. Click **New Design** and choose a template (Social Media, Presentation, etc.)
3. Use the Polotno editor to combine your uploaded assets with text, shapes, and templates
4. Export as PNG, JPEG, or PDF

> **Tip:** Your uploaded assets appear in the "My Assets" panel inside the editor, so you can drop them directly onto the canvas.

---

### Step 4: Share Your Work

Use **Share Links** to distribute assets externally:

- Create **password-protected** share links for sensitive content
- Set **expiry dates** for temporary access
- Choose between **view-only** and **edit** permissions
- Share entire **folders** or individual assets

---

### Next Steps

Explore these guides to unlock the full power of ImageMan:

- [API Authentication](/dashboard/docs/api-authentication) — Set up API keys for programmatic access
- [Image Transformations](/dashboard/docs/image-transforms) — Learn about on-the-fly image processing
- [White-Label Setup](/dashboard/docs/white-label-embed) — Embed img-man in your own product
`,

 'dashboard-overview': `
## Dashboard Overview

Your img-man dashboard is your command center — organized into sections accessible from the sidebar navigation. Each section is designed for a specific workflow.

---

### Navigation Structure

| Section | Description | Role Required |
|---------|-------------|---------------|
| **Assets** | Upload, browse, and manage your image library | All roles |
| **Designs** | Create and edit designs using the built-in editor | Editor+ |
| **AI Studio** | AI-powered tools: tagging, generation, background removal | Editor+ |
| **Shares** | Manage external share links with access controls | Editor+ |
| **Analytics** | View usage statistics, storage, and API metrics | Admin+ |
| **Billing** | Payment history and plan management | Admin+ |
| **Guides** | Documentation and help articles | All roles |
| **Settings** | Organization settings, theme, storage, API keys | Admin+ |

---

### Key Features

#### Asset Management

The Assets section is the heart of img-man. Here you can:

- **Folder-based organization** with unlimited nesting depth
- **Grid view** with thumbnail previews for all image formats
- **Advanced filtering** by type, tags, date, and dimensions
- **Bulk operations** — select multiple assets to move, delete, or tag
- **Drag & Drop** between folders for quick reorganization

#### Design Studio

The Design Studio gives you a full-featured graphic editor powered by Polotno SDK:

- Pre-built **templates** for social media, presentations, ads, and more
- **Text, shapes, backgrounds** with full customization
- Direct access to your **uploaded assets** from the "My Assets" panel
- Export to **PNG, JPEG, or PDF**

#### AI Tools

Powered by Google Vertex AI, the AI Studio includes:

- **Smart Tagging** — Automatically tag images with AI-generated labels
- **Background Removal** — Remove backgrounds in one click
- **Image Generation** — Generate new images from text prompts
- **Upscale** — Enhance image resolution with AI
- **AI Expand** — Extend image boundaries intelligently

---

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl/⌘ + U\` | Upload files |
| \`Ctrl/⌘ + K\` | Quick search |
| \`Delete\` | Move selected to trash |
| \`Ctrl/⌘ + D\` | Duplicate selected |
| \`Ctrl/⌘ + Click\` | Multi-select assets |
| \`Shift + Click\` | Range-select assets |

> **Pro Tip:** Use \`Ctrl/⌘ + K\` for instant search across all assets by name, tag, or folder.
`,

 'api-authentication': `
## API Authentication

img-man uses API keys for authenticating programmatic requests. This guide covers how to create keys, authenticate requests, and manage permissions.

### Creating an API Key

1. Navigate to **Settings → API Keys**
2. Click **Create New Key**
3. Configure the key:
 - **Name** — A descriptive label (e.g., "Production Backend", "Mobile App")
 - **Permissions** — Select which operations the key can perform
4. Copy the generated key immediately — it won't be shown again

### Authentication Methods

#### Header Authentication (Recommended)

Include your API key in the \`Authorization\` header:

\`\`\`bash
curl -X GET "https://api.yourdomain.com/v1/assets" \\
 -H "Authorization: Bearer im_live_abc123xyz..."
\`\`\`

#### Query Parameter

For simple integrations, you can pass the key as a query parameter:

\`\`\`
https://api.yourdomain.com/v1/assets?apiKey=im_live_abc123xyz...
\`\`\`

> **Note:** Header authentication is preferred for security.

### Key Permissions

| Permission | Description |
|-----------|-------------|
| \`read:assets\` | View and download images |
| \`write:assets\` | Upload and modify images |
| \`delete:assets\` | Delete images permanently |
| \`read:transforms\` | Access transformation endpoints |
| \`admin\` | Full access to all endpoints |

### Rate Limits

| Plan | Rate Limit |
|------|-----------|
| Free | 100 requests/min |
| Pro | 1,000 requests/min |
| Enterprise | 10,000 requests/min |

### Error Responses

\`\`\`json
{
 "error": "UNAUTHORIZED",
 "message": "Invalid or expired API key",
 "status": 401
}
\`\`\`

### Best Practices

- **Rotate keys regularly** — Create new keys and deprecate old ones
- **Use minimal permissions** — Only grant the permissions each integration needs
- **Never expose keys in client-side code** — Use server-side proxies instead
- **Monitor usage** — Check the Analytics page for unusual activity
`,

 'upload-api': `
## Upload API

Upload images programmatically using the img-man Upload API. Supports direct uploads, signed URL uploads, and URL imports.

### Direct Upload

Upload a file directly to the API:

\`\`\`bash
curl -X POST "https://api.yourdomain.com/v1/upload" \\
 -H "Authorization: Bearer im_live_abc123xyz..." \\
 -F "file=@/path/to/image.jpg" \\
 -F "folder=/marketing/2025" \\
 -F "tags=hero,banner"
\`\`\`

**Response:**
\`\`\`json
{
 "asset": {
 "id": "abc123",
 "filename": "image.jpg",
 "url": "https://cdn.yourdomain.com/marketing/2025/image.jpg",
 "size": 245760,
 "width": 1920,
 "height": 1080,
 "mimeType": "image/jpeg",
 "tags": ["hero", "banner"],
 "createdAt": "2025-01-15T10:30:00Z"
 }
}
\`\`\`

### Signed URL Upload (Recommended for Large Files)

For better performance with large files, use a two-step signed URL upload:

**Step 1: Get a signed upload URL**
\`\`\`bash
curl -X POST "https://api.yourdomain.com/v1/upload/signed-url" \\
 -H "Authorization: Bearer im_live_abc123xyz..." \\
 -H "Content-Type: application/json" \\
 -d '{"filename": "large-photo.png", "contentType": "image/png"}'
\`\`\`

**Step 2: Upload directly to cloud storage**
\`\`\`bash
curl -X PUT "<signed_url_from_step_1>" \\
 -H "Content-Type: image/png" \\
 --data-binary @/path/to/large-photo.png
\`\`\`

### URL Import

Import an image from an external URL:

\`\`\`bash
curl -X POST "https://api.yourdomain.com/v1/import" \\
 -H "Authorization: Bearer im_live_abc123xyz..." \\
 -H "Content-Type: application/json" \\
 -d '{
 "url": "https://example.com/photo.jpg",
 "folder": "/imports",
 "tags": ["imported"]
 }'
\`\`\`

### Upload Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`file\` | File | The image file to upload |
| \`folder\` | String | Destination folder path |
| \`tags\` | String | Comma-separated tags |
| \`filename\` | String | Override the original filename |
| \`autoTag\` | Boolean | Enable AI auto-tagging (default: true) |

### Size Limits

| Plan | Max File Size | Monthly Upload |
|------|--------------|----------------|
| Free | 10 MB | 1 GB |
| Pro | 50 MB | 50 GB |
| Enterprise | 200 MB | Unlimited |
`,

 'image-transforms': `
## Image Transformations

img-man provides powerful on-the-fly image transformations through URL parameters. Transform images without re-uploading by appending parameters to the CDN URL.

### URL Transformation Syntax

\`\`\`
https://cdn.yourdomain.com/path/to/image.jpg?w=800&h=600&fit=cover&q=85
\`\`\`

### Resize & Crop

| Parameter | Description | Example |
|-----------|-------------|---------|
| \`w\` | Width in pixels | \`?w=800\` |
| \`h\` | Height in pixels | \`?h=600\` |
| \`fit\` | Resize mode: \`cover\`, \`contain\`, \`fill\`, \`inside\`, \`outside\` | \`?fit=cover\` |
| \`position\` | Crop position: \`center\`, \`top\`, \`bottom\`, \`left\`, \`right\`, \`face\` | \`?position=face\` |

**Examples:**

\`\`\`
# Resize to 400px wide, maintain aspect ratio
?w=400

# Crop to exact 200×200 square, centered
?w=200&h=200&fit=cover

# Fit within 800×600 box without cropping
?w=800&h=600&fit=contain

# Smart crop focusing on faces
?w=300&h=300&fit=cover&position=face
\`\`\`

### Format Conversion

| Parameter | Values | Description |
|-----------|--------|-------------|
| \`format\` | \`webp\`, \`avif\`, \`jpeg\`, \`png\` | Output format |
| \`q\` | 1–100 | Quality (for lossy formats) |

\`\`\`
# Convert to WebP with 85% quality
?format=webp&q=85

# Convert to AVIF for maximum compression
?format=avif&q=80
\`\`\`

### Effects & Filters

| Parameter | Values | Description |
|-----------|--------|-------------|
| \`blur\` | 1–100 | Gaussian blur |
| \`sharpen\` | 1–100 | Sharpen amount |
| \`brightness\` | -100 to 100 | Brightness adjustment |
| \`contrast\` | -100 to 100 | Contrast adjustment |
| \`grayscale\` | \`true\` | Convert to grayscale |
| \`rotate\` | 0–360 | Rotation in degrees |
| \`flip\` | \`h\`, \`v\`, \`hv\` | Flip horizontal/vertical |

### Named Transforms

Create reusable transformation presets in **Settings → Transforms**:

\`\`\`
# Use a named transform called "thumbnail"
https://cdn.yourdomain.com/path/to/image.jpg?t=thumbnail

# Combine named transform with overrides
https://cdn.yourdomain.com/path/to/image.jpg?t=thumbnail&q=95
\`\`\`

### Chaining Transforms

Parameters can be combined freely:

\`\`\`
?w=600&h=400&fit=cover&format=webp&q=85&sharpen=20
\`\`\`

### Performance Tips

- **Use WebP/AVIF** — Modern formats save 25-50% bandwidth
- **Set appropriate quality** — q=80-85 is usually visually indistinguishable
- **Use named transforms** — Ensures consistency across your application
- **Leverage CDN caching** — Transformed images are cached at the edge
`,

 'white-label-embed': `
## White-Label & Embedding

Embed img-man into your own product with full white-label support. Customize branding, colors, and domain to match your platform.

### Quick Setup

1. Go to **Settings** → **General**
2. Configure your organization:
 - **Organization Name** — Your brand name shown throughout the dashboard
 - **Logo** — Upload your brand logo (recommended: 200×200px, PNG/SVG)
 - **Theme Color** — Choose from 8 color palettes or set a custom primary color

### Theme Customization

img-man supports 8 built-in color themes:

| Theme | Primary Color | Best For |
|-------|--------------|----------|
| Orange | #F97316 | Creative, energetic brands |
| Blue | #3B82F6 | Professional, corporate |
| Violet | #8B5CF6 | Creative, premium |
| Rose | #F43F5E | Fashion, lifestyle |
| Emerald | #10B981 | Nature, health |
| Amber | #F59E0B | Warm, friendly |
| Cyan | #06B6D4 | Tech, modern |
| Slate | #64748B | Minimal, enterprise |

### Embedding via iframe

Embed the img-man dashboard in your application:

\`\`\`html
<iframe
 src="https://yourdomain.com/dashboard?embed=true"
 width="100%"
 height="800"
 frameborder="0"
 allow="clipboard-write"
 style="border-radius: 12px; border: 1px solid #e5e7eb;"
></iframe>
\`\`\`

### JavaScript SDK Integration

\`\`\`html
<script src="https://cdn.yourdomain.com/sdk/imageman.js"></script>
<script>
 const picker = img-man.createPicker({
 apiKey: 'im_live_abc123xyz...',
 container: '#image-picker',
 onSelect: (asset) => {
 console.log('Selected:', asset.url);
 },
 theme: {
 primaryColor: '#3B82F6',
 borderRadius: '8px',
 },
 });
</script>
\`\`\`

### Custom Domain (Enterprise)

Map your own domain to the img-man dashboard:

1. Add a CNAME record: \`images.yourdomain.com → dashboard.imageman.io\`
2. Contact support to provision the SSL certificate
3. Configure the domain in **Settings → Custom Domain**

### API White-Labeling

All API responses can be served from your custom domain:

\`\`\`
https://api.yourdomain.com/v1/assets → proxied to ImageMan
https://cdn.yourdomain.com/path/image.jpg → served via your CDN
\`\`\`

### Team Access

Configure which sections your team can access:

1. Go to **Settings → Team**
2. Invite members with specific roles:
 - **Viewer** — Browse and download assets
 - **Editor** — Upload, edit, and organize
 - **Admin** — Full access including settings
 - **Owner** — Complete control including billing
`,

 'team-roles': `
## Team Management & Roles

Manage your team members and control access to different parts of the img-man dashboard.

### Role Hierarchy

img-man uses a 4-tier role system:

| Role | Level | Capabilities |
|------|-------|-------------|
| **Viewer** | 1 | Browse assets, download files, view shares |
| **Editor** | 2 | Upload, edit, organize assets, create designs |
| **Admin** | 3 | Manage team, settings, API keys, transforms |
| **Owner** | 4 | Full access including billing and plan management |

### Inviting Team Members

1. Navigate to **Settings → Team**
2. Click **Invite Member**
3. Enter the email address and select a role
4. The invite will be sent automatically

### Section Access Control

Admins can fine-tune which dashboard sections each role can access:

- **Assets** — Default: all roles
- **Design Studio** — Default: Editor+
- **AI Studio** — Default: Editor+
- **Shares** — Default: Editor+
- **Analytics** — Default: Admin+
- **Settings** — Default: Admin+

Configure these in **Settings → Section Access**.

### API Key Permissions

Each API key inherits permissions from the user who created it, but can be further restricted:

- Keys created by Editors cannot access admin endpoints
- Keys can have individual permissions toggled on/off
- Expired or revoked keys return \`401 Unauthorized\`

### Best Practices

- **Principle of Least Privilege** — Give team members only the access they need
- **Regular Audits** — Review team member roles quarterly
- **Use API Keys per Integration** — Don't share a single key across services
- **Enable Activity Logs** — Monitor team actions in the Analytics page
`,

 'billing-plans': `
## Billing & Plans

Understand img-man pricing, manage your subscription, and download payment receipts.

### Plans Overview

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Storage | 1 GB | 50 GB | Unlimited |
| Monthly Uploads | 100 | 5,000 | Unlimited |
| AI Credits | 10/month | 500/month | Custom |
| Team Members | 1 | 10 | Unlimited |
| API Rate Limit | 100/min | 1,000/min | 10,000/min |
| Custom Domain | ✗ | ✗ | ✓ |
| White-Label | ✗ | ✓ | ✓ |
| Priority Support | ✗ | ✓ | ✓ |
| **Price** | Free | $49/mo | Custom |

### Managing Your Subscription

1. Go to **Billing** in the sidebar
2. View your current plan and payment history
3. Click the receipt download icon on any payment to get a PDF

### Payment Methods

- Credit/Debit Card (Visa, Mastercard, Amex)
- PayPal (Enterprise only)
- Wire Transfer (Enterprise only)

### Payment History

All past payments are listed in the **Billing** page:
- View date, amount, and payment method
- Filter by status (Paid, Pending, Refunded)
- Download individual receipts as PDF

### Upgrading

To upgrade your plan:
1. Go to **Billing**
2. Contact support or click the upgrade prompt
3. Your new plan takes effect immediately
4. Pro-rated billing is applied for mid-cycle upgrades

### Cancellation

- You can cancel anytime from **Settings**
- Access continues until the end of your billing period
- Data is retained for 30 days after cancellation
- Download all your assets before the retention period ends
`,
};

/* ─── Categories & Guides ────────────────────────────── */

export const GUIDE_CATEGORIES: GuideCategory[] = [
 {
 name: 'Getting Started',
 description: 'Learn the basics of ImageMan',
 guides: [
 {
 slug: 'quick-start',
 title: 'Quick Start Guide',
 description: 'Upload your first image, create a design, and share it — in 5 minutes.',
 category: 'Getting Started',
 content: GUIDE_CONTENT['quick-start']!,
 },
 {
 slug: 'dashboard-overview',
 title: 'Dashboard Overview',
 description: 'Navigate the dashboard, understand sections, and learn keyboard shortcuts.',
 category: 'Getting Started',
 content: GUIDE_CONTENT['dashboard-overview']!,
 },
 ],
 },
 {
 name: 'API Reference',
 description: 'Integrate img-man into your applications',
 guides: [
 {
 slug: 'api-authentication',
 title: 'Authentication & API Keys',
 description: 'Create API keys, authenticate requests, and manage permissions.',
 category: 'API Reference',
 content: GUIDE_CONTENT['api-authentication']!,
 },
 {
 slug: 'upload-api',
 title: 'Upload API',
 description: 'Upload images via direct upload, signed URLs, or URL import.',
 category: 'API Reference',
 content: GUIDE_CONTENT['upload-api']!,
 },
 ],
 },
 {
 name: 'White-Label & Embedding',
 description: 'Customize and embed img-man in your product',
 guides: [
 {
 slug: 'white-label-embed',
 title: 'White-Label Setup',
 description: 'Customize branding, embed via iframe or SDK, and set up custom domains.',
 category: 'White-Label & Embedding',
 content: GUIDE_CONTENT['white-label-embed']!,
 },
 ],
 },
 {
 name: 'Image Transformations',
 description: 'On-the-fly image processing and optimization',
 guides: [
 {
 slug: 'image-transforms',
 title: 'Transformation Reference',
 description: 'Resize, crop, convert formats, apply effects — all via URL parameters.',
 category: 'Image Transformations',
 content: GUIDE_CONTENT['image-transforms']!,
 },
 ],
 },
 {
 name: 'Account & Security',
 description: 'Manage your team and billing',
 guides: [
 {
 slug: 'team-roles',
 title: 'Team Management & Roles',
 description: 'Invite members, assign roles, and configure section access.',
 category: 'Account & Security',
 content: GUIDE_CONTENT['team-roles']!,
 },
 {
 slug: 'billing-plans',
 title: 'Billing & Plans',
 description: 'Understand pricing, manage subscriptions, and download receipts.',
 category: 'Account & Security',
 content: GUIDE_CONTENT['billing-plans']!,
 },
 ],
 },
];

/* ─── Lookups ────────────────────────────────────────── */

export const ALL_GUIDES: Guide[] = GUIDE_CATEGORIES.flatMap((c) => c.guides);

export function getGuideBySlug(slug: string): Guide | undefined {
 return ALL_GUIDES.find((g) => g.slug === slug);
}
