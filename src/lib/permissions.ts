// SPDX-License-Identifier: Apache-2.0
/**
 * RBAC Permissions Library
 *
 * Role hierarchy: Owner(4) > Admin(3) > Editor(2) > Viewer(1)
 * Used for both server-side API guards and client-side UI gating.
 */

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export type Action =
 | 'view'
 | 'download'
 | 'upload'
 | 'edit'
 | 'delete'
 | 'ai'
 | 'design'
 | 'share'
 | 'invite_viewer'
 | 'invite_editor'
 | 'invite_admin'
 | 'remove_member'
 | 'manage_settings'
 | 'manage_api_keys'
 | 'manage_billing'
 | 'delete_org'
 | 'transfer_ownership';

// ─── Role Power Levels ─────────────────────────────────────────
export const ROLE_LEVEL: Record<Role, number> = {
 owner: 4,
 admin: 3,
 editor: 2,
 viewer: 1,
};

// ─── Permission Matrix ─────────────────────────────────────────
// Maps each action to the minimum role level required
const ACTION_MIN_LEVEL: Record<Action, number> = {
 view: 1, // viewer+
 download: 1, // viewer+
 upload: 2, // editor+
 edit: 2, // editor+
 delete: 2, // editor+
 ai: 2, // editor+
 design: 2, // editor+
 share: 2, // editor+
 invite_viewer: 2, // editor+
 invite_editor: 3, // admin+
 invite_admin: 4, // owner only
 remove_member: 3, // admin+ (with hierarchy constraint)
 manage_settings: 3, // admin+
 manage_api_keys: 3, // admin+
 manage_billing: 4, // owner only
 delete_org: 4, // owner only
 transfer_ownership: 4, // owner only
};

/**
 * Check if a role can perform a specific action.
 */
export function canPerform(role: Role, action: Action): boolean {
 return ROLE_LEVEL[role] >= ACTION_MIN_LEVEL[action];
}

/**
 * Check if a user with `myRole` can invite someone at `targetRole`.
 * You can only invite users to a role BELOW yours.
 */
export function canInviteRole(myRole: Role, targetRole: Role): boolean {
 if (targetRole === 'owner') return false; // can never invite an owner
 return ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole];
}

/**
 * Check if a user with `myRole` can change another user's role.
 * Can only change roles of users with lower power level,
 * and only to roles lower than your own.
 */
export function canChangeRole(
 myRole: Role,
 currentTargetRole: Role,
 newTargetRole: Role,
): boolean {
 if (newTargetRole === 'owner') return false;
 const myLevel = ROLE_LEVEL[myRole];
 const targetLevel = ROLE_LEVEL[currentTargetRole];
 const newLevel = ROLE_LEVEL[newTargetRole];
 // Must be higher than current target AND new target role
 return myLevel > targetLevel && myLevel > newLevel;
}

/**
 * Check if a user with `myRole` can remove a user at `targetRole`.
 * Owner can remove anyone. Admin can remove Editor/Viewer.
 */
export function canRemoveMember(myRole: Role, targetRole: Role): boolean {
 if (targetRole === 'owner') return false; // never remove the owner
 return ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole];
}

/**
 * Get the numeric power level for a role (for comparisons).
 */
export function getRoleLevel(role: Role): number {
 return ROLE_LEVEL[role];
}

/**
 * Get all roles a user can invite (roles below their own, excluding owner).
 */
export function getInvitableRoles(myRole: Role): Role[] {
 const myLevel = ROLE_LEVEL[myRole];
 return (Object.entries(ROLE_LEVEL) as [Role, number][])
 .filter(([r, level]) => level < myLevel && r !== 'owner')
 .map(([r]) => r)
 .sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a]);
}

/**
 * All roles in descending order of power.
 */
export const ALL_ROLES: Role[] = ['owner', 'admin', 'editor', 'viewer'];

/**
 * Role display labels and colors (for UI badges).
 */
export const ROLE_META: Record<
 Role,
 { label: string; color: string; bgColor: string }
> = {
 owner: {
 label: 'Owner',
 color: 'text-amber-700',
 bgColor: 'bg-amber-50 border-amber-200',
 },
 admin: {
 label: 'Admin',
 color: 'text-blue-700',
 bgColor: 'bg-blue-50 border-blue-200',
 },
 editor: {
 label: 'Editor',
 color: 'text-green-700',
 bgColor: 'bg-green-50 border-green-200',
 },
 viewer: {
 label: 'Viewer',
 color: 'text-dash-text2',
 bgColor: 'bg-dash-muted border-dash-border',
 },
};
