# Map

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans (requires photos with GPS EXIF data)

## What it does

Plots your photos on an interactive map using the GPS coordinates embedded in their EXIF metadata, so you can browse your library by location.

## When to use it

- Finding every photo taken at a specific venue or region.
- Verifying location data before sharing a geotagged asset externally.
- Exploring photos from a trip without remembering file names or dates.

## Requirements

Photos must have GPS latitude and longitude in their EXIF data. Most smartphone photos include this automatically. DSLR and mirrorless cameras require GPS to be enabled or a GPS-enabled body/accessory. img-man reads the EXIF coordinates on upload; coordinates are stored in the asset metadata and are not modified.

## Step-by-step

### Browse by location

1. Open **Map** in the sidebar (under the Assets group).
2. The map loads centered on the midpoint of your geotagged collection.
3. Pin clusters show the number of photos in that area. Zoom in to see individual pins.
4. Click a pin to see a thumbnail preview of the photo, the camera model, and the capture date.

### Zoom and pan

- Use the **+** / **-** buttons or scroll to zoom.
- Click and drag to pan.
- Click **Fit all** (⊞) to zoom to the bounding box of your entire geotagged collection.

## Tips & limits

- Only assets with valid GPS data appear on the map. Photos without location data are not shown, but they are still visible in your main asset library.
- Map tiles are served by OpenStreetMap. The map requires an internet connection and will show a grey placeholder when offline.
- Coordinates are stored verbatim from the EXIF. If a camera's GPS was wrong, the pin will be wrong. Edit the metadata from the asset Details panel to correct it.
- For privacy, consider stripping GPS data from assets before sharing them publicly. Use the asset export options or a tool like ExifTool before uploading.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| No pins appear | No photos have GPS data, or they haven't finished processing. | Check the asset Details panel for a photo; if **Location** is blank, the file has no GPS EXIF. |
| Map tiles show as grey | Network issue or ad blocker blocking tile requests. | Disable the ad blocker for the dashboard domain or check your network. |
| Pin is in the wrong place | EXIF GPS was incorrect when the photo was taken. | Edit the location in the asset Details panel. |
| A recent upload isn't on the map | EXIF processing is async. | Wait a minute and refresh. |

## Related

- [Assets](assets.md)
- [Smart Albums](smart-albums.md) — rule-based collections that can filter by location metadata.
