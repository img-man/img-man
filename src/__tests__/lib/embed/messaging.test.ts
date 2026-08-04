// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';

import {
 postToParent,
 notifyReady,
 notifyAssetSelected,
 notifyAssetsConfirmed,
 notifyUploadComplete,
 notifyError,
 onParentCommand,
 onWidgetEvent,
 sendToWidget,
} from '@/lib/embed/messaging';

describe('Embed Messaging', () => {
 describe('Type definitions', () => {
 it('exports all outbound notification functions', () => {
 expect(typeof postToParent).toBe('function');
 expect(typeof notifyReady).toBe('function');
 expect(typeof notifyAssetSelected).toBe('function');
 expect(typeof notifyAssetsConfirmed).toBe('function');
 expect(typeof notifyUploadComplete).toBe('function');
 expect(typeof notifyError).toBe('function');
 });

 it('exports parent command listener', () => {
 expect(typeof onParentCommand).toBe('function');
 });

 it('exports widget event listener', () => {
 expect(typeof onWidgetEvent).toBe('function');
 });

 it('exports sendToWidget function', () => {
 expect(typeof sendToWidget).toBe('function');
 });
 });

 describe('notifyReady', () => {
 it('does not throw when called (no parent frame)', () => {
 expect(() => notifyReady()).not.toThrow();
 });
 });

 describe('notifyError', () => {
 it('does not throw when called with error details', () => {
 expect(() => notifyError('TEST_ERR', 'test message')).not.toThrow();
 });
 });

 describe('onParentCommand', () => {
 it('returns an unsubscribe function', () => {
 const unsub = onParentCommand(() => {});
 expect(typeof unsub).toBe('function');
 unsub(); // Should not throw
 });
 });

 describe('onWidgetEvent', () => {
 it('returns an unsubscribe function', () => {
 const unsub = onWidgetEvent(() => {});
 expect(typeof unsub).toBe('function');
 unsub();
 });
 });

 describe('notifyAssetSelected', () => {
 it('does not throw with valid asset data', () => {
 expect(() =>
 notifyAssetSelected({
 id: 'a1',
 url: 'https://example.com/img.png',
 name: 'test.png',
 mimeType: 'image/png',
 width: 800,
 height: 600,
 }),
 ).not.toThrow();
 });
 });

 describe('notifyAssetsConfirmed', () => {
 it('handles empty array', () => {
 expect(() => notifyAssetsConfirmed([])).not.toThrow();
 });

 it('handles multiple assets', () => {
 expect(() =>
 notifyAssetsConfirmed([
 { id: 'a1', url: '', name: 'a.png', mimeType: 'image/png', width: 100, height: 100 },
 { id: 'a2', url: '', name: 'b.jpg', mimeType: 'image/jpeg', width: 200, height: 200 },
 ]),
 ).not.toThrow();
 });
 });
});
