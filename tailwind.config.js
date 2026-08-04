// SPDX-License-Identifier: Apache-2.0
/**
 * Tailwind CSS v4 Configuration
 *
 * Note: Tailwind v4 primarily uses CSS-based configuration via @theme
 * directives in globals.css. This file is provided as a reference and
 * can be loaded in CSS with: @config "../../tailwind.config.js";
 *
 * Custom animations (fade-in, fade-in-up, float, glow-pulse, slide-up,
 * shimmer) are defined in src/app/globals.css via @theme inline and
 * @keyframes blocks — which is the idiomatic Tailwind v4 approach.
 */

/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ededed',
        surface: '#111111',
        'surface-hover': '#161616',
      },
      animation: {
        'fade-in': 'fade-in 0.8s ease-out both',
        'fade-in-up': 'fade-in-up 0.7s ease-out both',
        float: 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(40px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
