// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
 canPerform,
 canInviteRole,
 canChangeRole,
 canRemoveMember,
 getRoleLevel,
 getInvitableRoles,
 ALL_ROLES,
 ROLE_META,
 type Role,
 type Action,
} from '@/lib/permissions';

describe('permissions', () => {
 describe('canPerform', () => {
 it('viewer can view and download', () => {
 expect(canPerform('viewer', 'view')).toBe(true);
 expect(canPerform('viewer', 'download')).toBe(true);
 });

 it('viewer cannot upload, edit, delete, or AI', () => {
 expect(canPerform('viewer', 'upload')).toBe(false);
 expect(canPerform('viewer', 'edit')).toBe(false);
 expect(canPerform('viewer', 'delete')).toBe(false);
 expect(canPerform('viewer', 'ai')).toBe(false);
 });

 it('editor can upload, edit, delete, and use AI', () => {
 expect(canPerform('editor', 'upload')).toBe(true);
 expect(canPerform('editor', 'edit')).toBe(true);
 expect(canPerform('editor', 'delete')).toBe(true);
 expect(canPerform('editor', 'ai')).toBe(true);
 expect(canPerform('editor', 'design')).toBe(true);
 expect(canPerform('editor', 'share')).toBe(true);
 });

 it('editor cannot manage settings or invite admins', () => {
 expect(canPerform('editor', 'manage_settings')).toBe(false);
 expect(canPerform('editor', 'invite_admin')).toBe(false);
 expect(canPerform('editor', 'remove_member')).toBe(false);
 });

 it('admin can manage settings and invite editors', () => {
 expect(canPerform('admin', 'manage_settings')).toBe(true);
 expect(canPerform('admin', 'manage_api_keys')).toBe(true);
 expect(canPerform('admin', 'invite_editor')).toBe(true);
 expect(canPerform('admin', 'remove_member')).toBe(true);
 });

 it('admin cannot manage billing, delete org, or transfer ownership', () => {
 expect(canPerform('admin', 'manage_billing')).toBe(false);
 expect(canPerform('admin', 'delete_org')).toBe(false);
 expect(canPerform('admin', 'transfer_ownership')).toBe(false);
 });

 it('owner can do everything', () => {
 const allActions: Action[] = [
 'view',
 'download',
 'upload',
 'edit',
 'delete',
 'ai',
 'design',
 'share',
 'invite_viewer',
 'invite_editor',
 'invite_admin',
 'remove_member',
 'manage_settings',
 'manage_api_keys',
 'manage_billing',
 'delete_org',
 'transfer_ownership',
 ];
 for (const action of allActions) {
 expect(canPerform('owner', action)).toBe(true);
 }
 });
 });

 describe('canInviteRole', () => {
 it('nobody can invite an owner', () => {
 expect(canInviteRole('owner', 'owner')).toBe(false);
 expect(canInviteRole('admin', 'owner')).toBe(false);
 });

 it('owner can invite admin, editor, viewer', () => {
 expect(canInviteRole('owner', 'admin')).toBe(true);
 expect(canInviteRole('owner', 'editor')).toBe(true);
 expect(canInviteRole('owner', 'viewer')).toBe(true);
 });

 it('admin can invite editor and viewer only', () => {
 expect(canInviteRole('admin', 'admin')).toBe(false);
 expect(canInviteRole('admin', 'editor')).toBe(true);
 expect(canInviteRole('admin', 'viewer')).toBe(true);
 });

 it('editor can invite viewers only', () => {
 expect(canInviteRole('editor', 'editor')).toBe(false);
 expect(canInviteRole('editor', 'viewer')).toBe(true);
 });

 it('viewer cannot invite anyone', () => {
 expect(canInviteRole('viewer', 'viewer')).toBe(false);
 });
 });

 describe('canChangeRole', () => {
 it('owner can change admin to editor', () => {
 expect(canChangeRole('owner', 'admin', 'editor')).toBe(true);
 });

 it('owner can change editor to viewer', () => {
 expect(canChangeRole('owner', 'editor', 'viewer')).toBe(true);
 });

 it('nobody can change someone to owner', () => {
 expect(canChangeRole('owner', 'admin', 'owner')).toBe(false);
 });

 it('admin can change editor to viewer', () => {
 expect(canChangeRole('admin', 'editor', 'viewer')).toBe(true);
 });

 it('admin cannot change another admin', () => {
 expect(canChangeRole('admin', 'admin', 'viewer')).toBe(false);
 });

 it('editor cannot change someone at or above their level', () => {
 expect(canChangeRole('editor', 'editor', 'viewer')).toBe(false);
 });
 });

 describe('canRemoveMember', () => {
 it('nobody can remove the owner', () => {
 expect(canRemoveMember('owner', 'owner')).toBe(false);
 expect(canRemoveMember('admin', 'owner')).toBe(false);
 });

 it('owner can remove admins, editors, viewers', () => {
 expect(canRemoveMember('owner', 'admin')).toBe(true);
 expect(canRemoveMember('owner', 'editor')).toBe(true);
 expect(canRemoveMember('owner', 'viewer')).toBe(true);
 });

 it('admin can remove editors and viewers', () => {
 expect(canRemoveMember('admin', 'editor')).toBe(true);
 expect(canRemoveMember('admin', 'viewer')).toBe(true);
 });

 it('admin cannot remove another admin', () => {
 expect(canRemoveMember('admin', 'admin')).toBe(false);
 });

 it('editor can remove viewer (higher level)', () => {
 expect(canRemoveMember('editor', 'viewer')).toBe(true);
 });

 it('editor cannot remove editor (same level)', () => {
 expect(canRemoveMember('editor', 'editor')).toBe(false);
 });

 it('viewer cannot remove anyone', () => {
 expect(canRemoveMember('viewer', 'viewer')).toBe(false);
 });
 });

 describe('getRoleLevel', () => {
 it('returns correct power levels', () => {
 expect(getRoleLevel('owner')).toBe(4);
 expect(getRoleLevel('admin')).toBe(3);
 expect(getRoleLevel('editor')).toBe(2);
 expect(getRoleLevel('viewer')).toBe(1);
 });

 it('maintains strict ordering', () => {
 expect(getRoleLevel('owner')).toBeGreaterThan(getRoleLevel('admin'));
 expect(getRoleLevel('admin')).toBeGreaterThan(getRoleLevel('editor'));
 expect(getRoleLevel('editor')).toBeGreaterThan(getRoleLevel('viewer'));
 });
 });

 describe('getInvitableRoles', () => {
 it('owner can invite admin, editor, viewer (descending order)', () => {
 expect(getInvitableRoles('owner')).toEqual(['admin', 'editor', 'viewer']);
 });

 it('admin can invite editor, viewer', () => {
 expect(getInvitableRoles('admin')).toEqual(['editor', 'viewer']);
 });

 it('editor can invite viewer', () => {
 expect(getInvitableRoles('editor')).toEqual(['viewer']);
 });

 it('viewer has empty invitable list', () => {
 expect(getInvitableRoles('viewer')).toEqual([]);
 });
 });

 describe('ALL_ROLES', () => {
 it('contains all four roles in descending power order', () => {
 expect(ALL_ROLES).toEqual(['owner', 'admin', 'editor', 'viewer']);
 });
 });

 describe('ROLE_META', () => {
 it('has metadata for every role', () => {
 for (const role of ALL_ROLES) {
 expect(ROLE_META[role]).toBeDefined();
 expect(ROLE_META[role].label).toBeTruthy();
 expect(ROLE_META[role].color).toBeTruthy();
 expect(ROLE_META[role].bgColor).toBeTruthy();
 }
 });
 });
});
