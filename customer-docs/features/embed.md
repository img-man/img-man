# Embed SDK

> **Status:** PUBLISHED
> **Last updated:** 2026-05-04
> **Applies to:** Pro and above (API key required)

## What it does

The img-man Embed SDK is a drop-in widget your site can use to let users pick or upload assets to your img-man organization without leaving your page.

## When to use it

- A SaaS form needs a reliable image picker / uploader.
- You want users to upload directly to img-man storage without your server proxying bytes.
- You need a branded, white-labeled flow inside your own product.

## Step-by-step

1. In the dashboard, go to **Settings → API Keys** and create a key.
   Use **read** scope for a picker-only flow or **write** if the widget also needs to upload.
2. Add the SDK script to your page and create a container for the iframe:
   ```html
   <div id="imageman-container" style="width: 100%; height: 500px"></div>
   <script src="https://<your-imageman-host>/sdk/imageman.js"></script>
   ```
3. Mount the widget with the published script-tag surface:
   ```html
   <script>
     const widget = new img-man.Widget({
       container: '#imageman-container',
       orgSlug: 'acme-corp',
       apiKey: 'IM_KEY_...',
       mode: 'uploader',
       onUpload: (asset) => {
         document.querySelector('input[name=image]').value = asset.url;
       },
       onError: (error) => {
         console.error('img-man widget error', error);
       },
     });

     widget.open();
   </script>
   ```
4. For npm or framework apps, install the package and use the named export:
   ```ts
   import { ImageManWidget } from '@imageman/sdk';

   const widget = new ImageManWidget({
     container: document.getElementById('imageman-container'),
     orgSlug: 'acme-corp',
     apiKey: 'IM_KEY_...',
     mode: 'picker',
     onSelect: (assets) => {
       console.log('Selected assets', assets);
     },
   });

   widget.open();
   ```
5. Submit your form or save the selected asset. The returned `asset.url` is a stable [public asset URL](public-asset-url.md).

## Framework examples

### React

```tsx
import { useEffect, useRef } from 'react';
import { ImageManWidget } from '@imageman/sdk';

function AssetPicker({ onSelect }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    widgetRef.current = new ImageManWidget({
      container: containerRef.current,
      orgSlug: 'acme-corp',
      apiKey: import.meta.env.VITE_IMAGEMAN_API_KEY,
      mode: 'picker',
      maxFiles: 3,
      onSelect,
    });

    widgetRef.current.open();
    return () => widgetRef.current?.destroy();
  }, [onSelect]);

  return <div ref={containerRef} style={{ width: '100%', height: 500 }} />;
}
```

### Vue

```vue
<template>
  <div ref="container" style="width: 100%; height: 500px" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ImageManWidget } from '@imageman/sdk';

const container = ref(null);
const emit = defineEmits(['select']);
let widget = null;

onMounted(() => {
  widget = new ImageManWidget({
    container: container.value,
    orgSlug: 'acme-corp',
    apiKey: import.meta.env.VITE_IMAGEMAN_API_KEY,
    mode: 'picker',
    onSelect: (assets) => emit('select', assets),
  });

  widget.open();
});

onUnmounted(() => widget?.destroy());
</script>
```

## Modes

| Mode | What it shows | Typical use |
| --- | --- | --- |
| `picker` | The asset library. | Letting users select an existing asset. |
| `uploader` | Upload UI only. | Capturing fresh uploads (camera, file). |
| `full` | Picker + uploader + tabs. | A complete media flow inside your app. |

## Tips & limits

- Add your domain to **Settings → Integrations → Allowed origins**, otherwise the API key will be refused with CORS.
- The widget supports drag-and-drop, paste, and URL import out of the box.
- Use `onSelect` for picker/full flows and `onUpload` for uploader/full flows.
- Theme it via the `theme` option, then update it later with `widget.setTheme(...)` if your app theme changes at runtime.
- In React or Vue, create the widget after the container element exists and destroy it on unmount.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `img-man is not defined` | The SDK script did not load before your widget code ran. | Load `/sdk/imageman.js` first, then create `new img-man.Widget(...)`. |
| `container not found` | The selector in `container` does not match a real element. | Create the container div before calling `new img-man.Widget(...)`, or pass the actual `HTMLElement`. |
| The widget duplicates itself after a re-render | The framework recreated the widget without tearing down the old instance. | Keep the widget in a ref and call `destroy()` during unmount or effect cleanup. |
| `CORS blocked` in console | Your origin isn't whitelisted. | Add it under Settings → Integrations. |
| `401 Unauthorized` on upload | API key has wrong scope. | Re-issue with `write` scope. |
| Upload seems to succeed but `asset.url` is empty | Older SDK version that doesn't surface `publicUrl`. | Update to the current SDK build. |

## Related

- [API keys](api-keys.md)
- [Public asset URL](public-asset-url.md)
- API Playground — available in-app at `/dashboard/api-playground`.
