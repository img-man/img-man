// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 10 – EXIF Metadata Extraction
 *
 * Uses `sharp` to extract EXIF/GPS metadata from image buffers.
 * Non-fatal: callers should catch and log errors.
 */

export interface ExifData {
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  focalLength?: string;
  dateTime?: Date;
  gps?: { latitude: number; longitude: number };
}

/**
 * Extract EXIF metadata from an image buffer via sharp.
 * Returns only the fields that are present.
 */
export async function extractExifData(
  buffer: Buffer,
): Promise<ExifData | null> {
  const sharp = (await import('sharp')).default;

  const metadata = await sharp(buffer).metadata();
  const exifRaw = metadata.exif;

  if (!exifRaw) return null;

  // sharp exposes parsed EXIF through metadata — but detailed parsing
  // requires reading the EXIF buffer. Use a lightweight parser.
  const parsed = parseExifBuffer(exifRaw);

  const result: ExifData = {};
  let hasData = false;

  // Camera make + model
  const make = parsed['Make'];
  const model = parsed['Model'];
  if (make || model) {
    result.camera = [make, model].filter(Boolean).map(String).join(' ');
    hasData = true;
  }

  // Lens
  if (parsed['LensModel']) {
    result.lens = String(parsed['LensModel']);
    hasData = true;
  }

  // ISO
  if (parsed['ISOSpeedRatings']) {
    result.iso = Number(parsed['ISOSpeedRatings']);
    hasData = true;
  }

  // Aperture (FNumber)
  if (parsed['FNumber']) {
    result.aperture = `f/${parsed['FNumber']}`;
    hasData = true;
  }

  // Shutter speed (ExposureTime)
  if (parsed['ExposureTime']) {
    const et = Number(parsed['ExposureTime']);
    result.shutter = et >= 1 ? `${et}s` : `1/${Math.round(1 / et)}s`;
    hasData = true;
  }

  // Focal length
  if (parsed['FocalLength']) {
    result.focalLength = `${parsed['FocalLength']}mm`;
    hasData = true;
  }

  // DateTime
  if (parsed['DateTimeOriginal'] || parsed['DateTime']) {
    const dtStr = String(parsed['DateTimeOriginal'] || parsed['DateTime']);
    const dt = parseExifDate(dtStr);
    if (dt) {
      result.dateTime = dt;
      hasData = true;
    }
  }

  // GPS coordinates
  const gps = extractGps(parsed);
  if (gps) {
    result.gps = gps;
    hasData = true;
  }

  return hasData ? result : null;
}

/**
 * Lightweight EXIF buffer parser.
 * Parses IFD0, EXIF IFD, and GPS IFD from raw EXIF bytes.
 */
function parseExifBuffer(
  buf: Buffer,
): Record<string, string | number | number[]> {
  const result: Record<string, string | number | number[]> = {};

  try {
    // EXIF starts with "Exif\0\0" then TIFF header
    let offset = 0;
    if (
      buf[0] === 0x45 &&
      buf[1] === 0x78 &&
      buf[2] === 0x69 &&
      buf[3] === 0x66
    ) {
      offset = 6; // Skip "Exif\0\0"
    }

    const tiffStart = offset;

    // Byte order: 'II' = little-endian, 'MM' = big-endian
    const byteOrder =
      buf[tiffStart] === 0x49 && buf[tiffStart + 1] === 0x49 ? 'LE' : 'BE';

    const readU16 = (o: number): number =>
      byteOrder === 'LE' ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
    const readU32 = (o: number): number =>
      byteOrder === 'LE' ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
    const readI32 = (o: number): number =>
      byteOrder === 'LE' ? buf.readInt32LE(o) : buf.readInt32BE(o);

    // Read rational (two uint32s)
    const readRational = (o: number): number => {
      const num = readU32(o);
      const den = readU32(o + 4);
      return den === 0 ? 0 : num / den;
    };

    const readSRational = (o: number): number => {
      const num = readI32(o);
      const den = readI32(o + 4);
      return den === 0 ? 0 : num / den;
    };

    // Verify TIFF magic
    const magic = readU16(tiffStart + 2);
    if (magic !== 42) return result;

    const ifd0Offset = readU32(tiffStart + 4) + tiffStart;

    // Tag name map
    const tagNames: Record<number, string> = {
      0x010f: 'Make',
      0x0110: 'Model',
      0x8769: 'ExifIFD',
      0x8825: 'GPSIFD',
      0x829a: 'ExposureTime',
      0x829d: 'FNumber',
      0x8827: 'ISOSpeedRatings',
      0x9003: 'DateTimeOriginal',
      0x0132: 'DateTime',
      0x920a: 'FocalLength',
      0xa434: 'LensModel',
      // GPS tags
      0x0001: 'GPSLatitudeRef',
      0x0002: 'GPSLatitude',
      0x0003: 'GPSLongitudeRef',
      0x0004: 'GPSLongitude',
    };

    // Parse an IFD at the given offset
    const parseIfd = (ifdOffset: number, isGps = false): void => {
      if (ifdOffset + 2 > buf.length) return;
      const entryCount = readU16(ifdOffset);
      for (let i = 0; i < entryCount; i++) {
        const entryStart = ifdOffset + 2 + i * 12;
        if (entryStart + 12 > buf.length) break;

        const tag = readU16(entryStart);
        const type = readU16(entryStart + 2);
        const count = readU32(entryStart + 4);

        const tagName =
          isGps && tagNames[tag]
            ? tagNames[tag]
            : !isGps && tagNames[tag]
              ? tagNames[tag]
              : undefined;
        if (!tagName) continue;

        // Data or pointer
        const typeSize: Record<number, number> = {
          1: 1,
          2: 1,
          3: 2,
          4: 4,
          5: 8,
          7: 1,
          10: 8,
        };
        const totalBytes = (typeSize[type] || 1) * count;
        const valueOffset =
          totalBytes <= 4
            ? entryStart + 8
            : readU32(entryStart + 8) + tiffStart;

        if (valueOffset + totalBytes > buf.length) continue;

        // ASCII string
        if (type === 2) {
          const str = buf
            .subarray(valueOffset, valueOffset + count - 1)
            .toString('ascii')
            .trim();
          result[tagName] = str;
        }
        // SHORT
        else if (type === 3) {
          result[tagName] = readU16(valueOffset);
        }
        // LONG
        else if (type === 4) {
          result[tagName] = readU32(valueOffset);
        }
        // RATIONAL
        else if (type === 5) {
          if (count === 1) {
            result[tagName] = readRational(valueOffset);
          } else {
            const vals: number[] = [];
            for (let j = 0; j < count; j++) {
              vals.push(readRational(valueOffset + j * 8));
            }
            result[tagName] = vals;
          }
        }
        // SRATIONAL
        else if (type === 10) {
          if (count === 1) {
            result[tagName] = readSRational(valueOffset);
          } else {
            const vals: number[] = [];
            for (let j = 0; j < count; j++) {
              vals.push(readSRational(valueOffset + j * 8));
            }
            result[tagName] = vals;
          }
        }

        // Follow sub-IFDs
        if (tagName === 'ExifIFD') {
          const subOffset = readU32(entryStart + 8) + tiffStart;
          parseIfd(subOffset);
        }
        if (tagName === 'GPSIFD') {
          const subOffset = readU32(entryStart + 8) + tiffStart;
          parseIfd(subOffset, true);
        }
      }
    };

    parseIfd(ifd0Offset);
  } catch {
    // Graceful degradation — return what we have
  }

  return result;
}

/**
 * Convert EXIF GPS DMS (degrees-minutes-seconds) to decimal lat/lng.
 */
function extractGps(
  parsed: Record<string, string | number | number[]>,
): { latitude: number; longitude: number } | null {
  const lat = parsed['GPSLatitude'];
  const lng = parsed['GPSLongitude'];
  const latRef = parsed['GPSLatitudeRef'];
  const lngRef = parsed['GPSLongitudeRef'];

  if (!lat || !lng || !Array.isArray(lat) || !Array.isArray(lng)) return null;
  if (lat.length < 3 || lng.length < 3) return null;

  let latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
  let longitude = lng[0] + lng[1] / 60 + lng[2] / 3600;

  if (latRef === 'S') latitude = -latitude;
  if (lngRef === 'W') longitude = -longitude;

  // Validate ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  // Skip default 0,0 coordinate which usually indicates missing GPS
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

/**
 * Parse EXIF date string "YYYY:MM:DD HH:MM:SS" into a Date.
 */
function parseExifDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // EXIF format: "2024:01:15 14:30:00"
  const match = dateStr.match(
    /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return isNaN(dt.getTime()) ? null : dt;
}
