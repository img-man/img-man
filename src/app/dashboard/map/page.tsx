// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Map as MapIcon,
  Camera,
  Calendar,
  Loader2,
  ImageOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import Image from 'next/image';

interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  thumbnail: string | null;
  camera: string | null;
  dateTime: string | null;
  width: number;
  height: number;
}

interface MapState {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

// Tile math helpers
function lng2tile(lng: number, zoom: number) {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}
function lat2tile(lat: number, zoom: number) {
  return (
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
    Math.pow(2, zoom)
  );
}

function tile2lng(x: number, zoom: number) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}
function tile2lat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export default function MapPage() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [mapState, setMapState] = useState<MapState>({
    centerLat: 20,
    centerLng: 0,
    zoom: 2,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets/map?limit=1000');
      if (!res.ok) throw new Error('Failed to load map data');
      const data = await res.json();
      setMarkers(data.markers || []);

      // Auto-center map on markers
      if (data.markers?.length > 0) {
        const lats = data.markers.map((m: MapMarker) => m.lat);
        const lngs = data.markers.map((m: MapMarker) => m.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        setMapState({
          centerLat: (minLat + maxLat) / 2,
          centerLng: (minLng + maxLng) / 2,
          zoom: data.markers.length === 1 ? 12 : 4,
        });
      }
    } catch (err) {
      console.error('[Map] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  // Convert lat/lng to pixel position relative to map container
  const latLngToPixel = useCallback(
    (lat: number, lng: number) => {
      const { centerLat, centerLng, zoom } = mapState;
      const { w, h } = containerSize;

      const centerTileX = lng2tile(centerLng, zoom);
      const centerTileY = lat2tile(centerLat, zoom);
      const markerTileX = lng2tile(lng, zoom);
      const markerTileY = lat2tile(lat, zoom);

      const pixelX = w / 2 + (markerTileX - centerTileX) * 256;
      const pixelY = h / 2 + (markerTileY - centerTileY) * 256;

      return { x: pixelX, y: pixelY };
    },
    [mapState, containerSize],
  );

  // Generate visible tile grid
  const getTiles = useCallback(() => {
    const { centerLat, centerLng, zoom } = mapState;
    const { w, h } = containerSize;

    const centerTileX = lng2tile(centerLng, zoom);
    const centerTileY = lat2tile(centerLat, zoom);

    const tilesX = Math.ceil(w / 256) + 2;
    const tilesY = Math.ceil(h / 256) + 2;

    const startTileX = Math.floor(centerTileX - tilesX / 2);
    const startTileY = Math.floor(centerTileY - tilesY / 2);

    const maxTile = Math.pow(2, zoom);
    const tiles: { x: number; y: number; screenX: number; screenY: number }[] =
      [];

    for (let tx = startTileX; tx < startTileX + tilesX + 1; tx++) {
      for (let ty = startTileY; ty < startTileY + tilesY + 1; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        const screenX = w / 2 + (tx - centerTileX) * 256;
        const screenY = h / 2 + (ty - centerTileY) * 256;
        tiles.push({ x: wrappedX, y: ty, screenX, screenY });
      }
    }
    return tiles;
  }, [mapState, containerSize]);

  const handleZoom = (delta: number) => {
    setMapState((prev) => ({
      ...prev,
      zoom: Math.max(1, Math.min(18, prev.zoom + delta)),
    }));
  };

  const handleFitAll = () => {
    if (markers.length === 0) return;
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    setMapState({
      centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
      centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      zoom: markers.length === 1 ? 12 : 3,
    });
  };

  // Panning via mouse drag
  const dragStart = useRef<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      lat: mapState.centerLat,
      lng: mapState.centerLng,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const scale = 256 * Math.pow(2, mapState.zoom);
    const dLng = (-dx / scale) * 360;
    const dLat = (dy / scale) * 180;
    setMapState({
      ...mapState,
      centerLat: Math.max(-85, Math.min(85, dragStart.current.lat + dLat)),
      centerLng: dragStart.current.lng + dLng,
    });
  };

  const handleMouseUp = () => {
    dragStart.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 1 : -1);
  };

  const tiles = getTiles();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <MapIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Map View
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {markers.length} geotagged photos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(1)}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleFitAll}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Fit all markers"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map area */}
      <div className="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading map data…</span>
          </div>
        ) : markers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-zinc-400">
            <ImageOff className="h-16 w-16" />
            <div className="text-center">
              <p className="text-lg font-medium">No geotagged photos</p>
              <p className="mt-1 text-sm">
                Upload photos with GPS EXIF data to see them on the map
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative h-full w-full cursor-grab select-none active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Tile layer */}
            {tiles.map((tile) => (
              <img
                key={`${mapState.zoom}-${tile.x}-${tile.y}`}
                src={`https://tile.openstreetmap.org/${mapState.zoom}/${tile.x}/${tile.y}.png`}
                alt=""
                draggable={false}
                className="absolute"
                style={{
                  left: tile.screenX,
                  top: tile.screenY,
                  width: 256,
                  height: 256,
                }}
              />
            ))}

            {/* Markers */}
            {markers.map((marker) => {
              const pos = latLngToPixel(marker.lat, marker.lng);
              if (
                pos.x < -20 ||
                pos.x > containerSize.w + 20 ||
                pos.y < -20 ||
                pos.y > containerSize.h + 20
              )
                return null;

              return (
                <button
                  key={marker.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:z-20 hover:scale-125"
                  style={{ left: pos.x, top: pos.y }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(marker);
                  }}
                  title={marker.name}
                >
                  {marker.thumbnail ? (
                    <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white shadow-lg dark:border-zinc-700">
                      <Image
                        src={marker.thumbnail}
                        alt={marker.name}
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-lg dark:border-zinc-700">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Selected marker popup */}
            {selected && (
              <div
                className="absolute z-30 w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
                style={{
                  left: latLngToPixel(selected.lat, selected.lng).x,
                  top: latLngToPixel(selected.lat, selected.lng).y - 50,
                }}
              >
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>

                {selected.thumbnail && (
                  <div className="mb-2 overflow-hidden rounded-md">
                    <Image
                      src={selected.thumbnail}
                      alt={selected.name}
                      width={260}
                      height={160}
                      className="h-36 w-full object-cover"
                      unoptimized
                    />
                  </div>
                )}

                <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {selected.name}
                </h3>

                <div className="mt-1 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {selected.camera && (
                    <div className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      <span>{selected.camera}</span>
                    </div>
                  )}
                  {selected.dateTime && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(selected.dateTime).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="text-zinc-400">
                    {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                  </div>
                </div>

                <a
                  href={`/dashboard?asset=${selected.id}`}
                  className="mt-2 block text-center text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  View Photo →
                </a>
              </div>
            )}

            {/* Attribution */}
            <div className="absolute bottom-1 right-1 z-20 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800/80">
              ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                OpenStreetMap
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
