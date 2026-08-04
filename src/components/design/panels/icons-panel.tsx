// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Check, X, Plus, Minus,
  Star, Heart, Bookmark, Share2, Download, Upload, Eye, EyeOff,
  Settings, Search as SearchIcon, Home, User, Mail, Phone, Lock,
  Unlock, Bell, Calendar, Clock, MapPin, Image, Camera, Video,
  Music, File, Folder, Trash2, Edit3, Copy, Clipboard, Link,
  Globe, Wifi, Bluetooth, Battery, Sun, Moon, Cloud, Zap,
  Award, Gift, ShoppingCart, CreditCard, DollarSign, Tag,
  MessageCircle, MessageSquare, Send, ThumbsUp, ThumbsDown,
  AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle,
  XCircle, RefreshCw, RotateCw, Maximize, Minimize,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Menu, MoreHorizontal, MoreVertical, Grid, List,
  Filter, Sliders, Layers, Layout, Monitor, Smartphone, Tablet,
  Printer, Save, LogIn, LogOut, UserPlus, Users,
  Github, Twitter, Linkedin, Instagram, Facebook, Youtube,
  type LucideIcon,
} from 'lucide-react';

interface IconItem {
  name: string;
  category: string;
  Icon: LucideIcon;
}

const ICON_LIST: IconItem[] = [
  // Arrows
  { name: 'arrow-right', category: 'Arrows', Icon: ArrowRight },
  { name: 'arrow-left', category: 'Arrows', Icon: ArrowLeft },
  { name: 'arrow-up', category: 'Arrows', Icon: ArrowUp },
  { name: 'arrow-down', category: 'Arrows', Icon: ArrowDown },
  { name: 'chevron-right', category: 'Arrows', Icon: ChevronRight },
  { name: 'chevron-left', category: 'Arrows', Icon: ChevronLeft },
  { name: 'chevron-up', category: 'Arrows', Icon: ChevronUp },
  { name: 'chevron-down', category: 'Arrows', Icon: ChevronDown },
  { name: 'refresh', category: 'Arrows', Icon: RefreshCw },
  { name: 'rotate', category: 'Arrows', Icon: RotateCw },
  // Actions
  { name: 'check', category: 'Actions', Icon: Check },
  { name: 'x', category: 'Actions', Icon: X },
  { name: 'plus', category: 'Actions', Icon: Plus },
  { name: 'minus', category: 'Actions', Icon: Minus },
  { name: 'edit', category: 'Actions', Icon: Edit3 },
  { name: 'copy', category: 'Actions', Icon: Copy },
  { name: 'clipboard', category: 'Actions', Icon: Clipboard },
  { name: 'download', category: 'Actions', Icon: Download },
  { name: 'upload', category: 'Actions', Icon: Upload },
  { name: 'save', category: 'Actions', Icon: Save },
  { name: 'send', category: 'Actions', Icon: Send },
  { name: 'link', category: 'Actions', Icon: Link },
  { name: 'filter', category: 'Actions', Icon: Filter },
  { name: 'sliders', category: 'Actions', Icon: Sliders },
  { name: 'trash', category: 'Actions', Icon: Trash2 },
  { name: 'maximize', category: 'Actions', Icon: Maximize },
  { name: 'minimize', category: 'Actions', Icon: Minimize },
  // Social
  { name: 'heart', category: 'Social', Icon: Heart },
  { name: 'star', category: 'Social', Icon: Star },
  { name: 'bookmark', category: 'Social', Icon: Bookmark },
  { name: 'share', category: 'Social', Icon: Share2 },
  { name: 'thumbs-up', category: 'Social', Icon: ThumbsUp },
  { name: 'thumbs-down', category: 'Social', Icon: ThumbsDown },
  { name: 'message-circle', category: 'Social', Icon: MessageCircle },
  { name: 'message-square', category: 'Social', Icon: MessageSquare },
  { name: 'github', category: 'Social', Icon: Github },
  { name: 'twitter', category: 'Social', Icon: Twitter },
  { name: 'linkedin', category: 'Social', Icon: Linkedin },
  { name: 'instagram', category: 'Social', Icon: Instagram },
  { name: 'facebook', category: 'Social', Icon: Facebook },
  { name: 'youtube', category: 'Social', Icon: Youtube },
  // UI
  { name: 'settings', category: 'UI', Icon: Settings },
  { name: 'search', category: 'UI', Icon: SearchIcon },
  { name: 'home', category: 'UI', Icon: Home },
  { name: 'menu', category: 'UI', Icon: Menu },
  { name: 'more-h', category: 'UI', Icon: MoreHorizontal },
  { name: 'more-v', category: 'UI', Icon: MoreVertical },
  { name: 'grid', category: 'UI', Icon: Grid },
  { name: 'list', category: 'UI', Icon: List },
  { name: 'layers', category: 'UI', Icon: Layers },
  { name: 'layout', category: 'UI', Icon: Layout },
  { name: 'eye', category: 'UI', Icon: Eye },
  { name: 'eye-off', category: 'UI', Icon: EyeOff },
  { name: 'bell', category: 'UI', Icon: Bell },
  { name: 'info', category: 'UI', Icon: Info },
  { name: 'help', category: 'UI', Icon: HelpCircle },
  // People
  { name: 'user', category: 'People', Icon: User },
  { name: 'users', category: 'People', Icon: Users },
  { name: 'user-plus', category: 'People', Icon: UserPlus },
  { name: 'login', category: 'People', Icon: LogIn },
  { name: 'logout', category: 'People', Icon: LogOut },
  // Communication
  { name: 'mail', category: 'Communication', Icon: Mail },
  { name: 'phone', category: 'Communication', Icon: Phone },
  { name: 'globe', category: 'Communication', Icon: Globe },
  // Media
  { name: 'image', category: 'Media', Icon: Image },
  { name: 'camera', category: 'Media', Icon: Camera },
  { name: 'video', category: 'Media', Icon: Video },
  { name: 'music', category: 'Media', Icon: Music },
  // Misc
  { name: 'file', category: 'Misc', Icon: File },
  { name: 'folder', category: 'Misc', Icon: Folder },
  { name: 'lock', category: 'Misc', Icon: Lock },
  { name: 'unlock', category: 'Misc', Icon: Unlock },
  { name: 'calendar', category: 'Misc', Icon: Calendar },
  { name: 'clock', category: 'Misc', Icon: Clock },
  { name: 'map-pin', category: 'Misc', Icon: MapPin },
  { name: 'sun', category: 'Misc', Icon: Sun },
  { name: 'moon', category: 'Misc', Icon: Moon },
  { name: 'cloud', category: 'Misc', Icon: Cloud },
  { name: 'zap', category: 'Misc', Icon: Zap },
  { name: 'tag', category: 'Misc', Icon: Tag },
  // Status
  { name: 'check-circle', category: 'Status', Icon: CheckCircle },
  { name: 'x-circle', category: 'Status', Icon: XCircle },
  { name: 'alert-circle', category: 'Status', Icon: AlertCircle },
  { name: 'alert-triangle', category: 'Status', Icon: AlertTriangle },
  // Commerce
  { name: 'shopping-cart', category: 'Commerce', Icon: ShoppingCart },
  { name: 'credit-card', category: 'Commerce', Icon: CreditCard },
  { name: 'dollar-sign', category: 'Commerce', Icon: DollarSign },
  { name: 'gift', category: 'Commerce', Icon: Gift },
  { name: 'award', category: 'Commerce', Icon: Award },
  // Devices
  { name: 'monitor', category: 'Devices', Icon: Monitor },
  { name: 'smartphone', category: 'Devices', Icon: Smartphone },
  { name: 'tablet', category: 'Devices', Icon: Tablet },
  { name: 'printer', category: 'Devices', Icon: Printer },
  { name: 'wifi', category: 'Devices', Icon: Wifi },
  { name: 'bluetooth', category: 'Devices', Icon: Bluetooth },
  { name: 'battery', category: 'Devices', Icon: Battery },
];

const CATEGORIES = [...new Set(ICON_LIST.map(i => i.category))];

interface IconsPanelProps {
  onAddSvg: (svgContent: string, viewBox: string, label: string) => void;
}

/**
 * Renders a Lucide icon to an SVG path string for the canvas.
 * We render at size 24 (default viewBox 0 0 24 24).
 */
// iconToSvgPaths is unused — icon rendering uses getIconPaths() + inline SVG construction instead.

export default function IconsPanel({ onAddSvg }: IconsPanelProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState('#1a1a1a');
  const [iconSize, setIconSize] = useState(48);

  const filtered = useMemo(() => {
    let list = ICON_LIST;
    if (activeCategory) list = list.filter(i => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.includes(q) || i.category.toLowerCase().includes(q));
    }
    return list;
  }, [search, activeCategory]);

  const handleInsertIcon = useCallback(
    (item: IconItem) => {
      // Render icon to SVG string at the desired size
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('width', '24');
      svg.setAttribute('height', '24');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', iconColor);
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');

      // Use a hidden container to render the React component and extract SVG
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
      document.body.appendChild(container);

      // Create the icon using createElement approach
      const tempSvg = document.createElementNS(svgNS, 'svg');
      container.appendChild(tempSvg);

      // Use a simpler approach: render icon to a hidden DOM node via ReactDOM
      // Since we can't use ReactDOM.render easily, we'll use an SVG data URI approach
      const iconSvg =
        `<svg xmlns="${svgNS}" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
        `stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
        getIconPaths(item.name) +
        `</svg>`;

      document.body.removeChild(container);

      // Convert to data URI for use as image on canvas
      const blob = new Blob([iconSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      onAddSvg(url, '0 0 24 24', item.name);
    },
    [iconColor, onAddSvg],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="space-y-2 border-b border-dash-border p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="w-full rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-7 pr-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-dash-text-muted">Color:</span>
          <input
            type="color"
            value={iconColor}
            onChange={e => setIconColor(e.target.value)}
            className="h-5 w-8 cursor-pointer rounded border border-dash-border"
          />
          {/* Size picker */}
          <span className="text-[10px] text-dash-text-muted ml-auto">Size:</span>
          <select
            value={iconSize}
            onChange={e => setIconSize(+e.target.value)}
            className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
          >
            {[24, 32, 48, 64, 96, 128].map(s => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1 border-b border-dash-border p-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
            !activeCategory ? 'bg-violet-500 text-white' : 'bg-dash-muted text-dash-text2 hover:bg-dash-border'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
              activeCategory === cat ? 'bg-violet-500 text-white' : 'bg-dash-muted text-dash-text2 hover:bg-dash-border'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Icons grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {filtered.map(item => (
            <button
              key={item.name}
              onClick={() => handleInsertIcon(item)}
              title={item.name}
              className="flex aspect-square items-center justify-center rounded-lg border border-dash-border p-1.5 text-dash-text2 transition-all hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/30"
            >
              <item.Icon size={20} />
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No icons found
          </p>
        )}
      </div>

      <div className="border-t border-dash-border px-2 py-1.5">
        <p className="text-center text-[8px] text-dash-text-muted">
          {filtered.length} icons • Powered by Lucide
        </p>
      </div>
    </div>
  );
}

/* ─── Icon path data (subset for common icons) ─────────────────────────── */

function getIconPaths(name: string): string {
  const paths: Record<string, string> = {
    'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'refresh': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    'rotate': '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    'check': '<polyline points="20 6 9 17 4 12"/>',
    'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'minus': '<line x1="5" y1="12" x2="19" y2="12"/>',
    'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    'copy': '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    'clipboard': '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    'send': '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'trash': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'bookmark': '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'share': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    'thumbs-up': '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    'thumbs-down': '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'mail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'unlock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'sun': '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    'cloud': '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'tag': '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'shopping-cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    'dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    'gift': '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    'award': '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    'monitor': '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    'smartphone': '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    'wifi': '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    'file': '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
    'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    'video': '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    'music': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    'layers': '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    'layout': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
    'menu': '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    'more-h': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'more-v': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    'grid': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    'list': '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    'login': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    'logout': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
    'minimize': '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
    'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'github': '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    'twitter': '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>',
    'linkedin': '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    'instagram': '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    'facebook': '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    'youtube': '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
    'tablet': '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    'printer': '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    'bluetooth': '<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>',
    'battery': '<rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/>',
  };
  return paths[name] ?? '<circle cx="12" cy="12" r="8"/>';
}
