// SPDX-License-Identifier: Apache-2.0
/**
 * SecurityDialog Component — Phase 4, Week 13
 *
 * Dialog for configuring PDF encryption, passwords, and permissions.
 * Supports AES-256, AES-128, and RC4-128 encryption methods.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { X, Lock, Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import type {
  SecurityConfig,
  EncryptionMethod,
  PrintPermission,
} from '../types';
import { ENCRYPTION_METHODS } from '../constants';
import {
  createDefaultSecurityConfig,
  checkPasswordStrength,
  validateSecurityConfig,
  hasRestrictions,
  getEncryptionParams,
} from '../engine/security-engine';

/* ──────────────────────── Props ──────────────────────── */

interface SecurityDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (config: SecurityConfig) => void;
  initialConfig?: SecurityConfig;
}

/* ──────────────────────── Component ──────────────────────── */

export default function SecurityDialog({
  open,
  onClose,
  onApply,
  initialConfig,
}: SecurityDialogProps) {
  const [config, setConfig] = useState<SecurityConfig>(
    initialConfig ?? createDefaultSecurityConfig(),
  );
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  const userStrength = useMemo(
    () => checkPasswordStrength(config.userPassword),
    [config.userPassword],
  );
  const ownerStrength = useMemo(
    () => checkPasswordStrength(config.ownerPassword),
    [config.ownerPassword],
  );
  const validationErrors = useMemo(
    () => validateSecurityConfig(config),
    [config],
  );
  const encryptionInfo = useMemo(
    () => getEncryptionParams(config.encryptionMethod),
    [config.encryptionMethod],
  );

  const updatePermission = useCallback(
    <K extends keyof SecurityConfig['permissions']>(
      key: K,
      value: SecurityConfig['permissions'][K],
    ) => {
      setConfig((prev) => ({
        ...prev,
        permissions: { ...prev.permissions, [key]: value },
      }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    if (validationErrors.length > 0) return;
    onApply(config);
    onClose();
  }, [config, validationErrors, onApply, onClose]);

  const handleRemoveSecurity = useCallback(() => {
    onApply(createDefaultSecurityConfig());
    onClose();
  }, [onApply, onClose]);

  if (!open) return null;

  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[520px] max-h-[85vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-im-primary" />
            <h2 className="text-sm font-semibold text-dash-text">
              Document Security
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Encryption Method */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-dash-text">
              Encryption Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ENCRYPTION_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      encryptionMethod: method.value as EncryptionMethod,
                    }))
                  }
                  className={`rounded-lg border p-2 text-center text-xs transition ${
                    config.encryptionMethod === method.value
                      ? 'border-im-primary bg-im-primary/10 text-im-primary'
                      : 'border-dash-border text-dash-text-muted hover:border-dash-text/30'
                  }`}
                >
                  <div className="font-medium">{method.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">
                    {method.description}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-dash-text-muted">
              PDF spec V={encryptionInfo.V}, R={encryptionInfo.R} •{' '}
              {encryptionInfo.keyLength}-bit key
            </p>
          </section>

          {/* Passwords */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-dash-text flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Passwords
            </h3>

            {/* User Password */}
            <div className="space-y-1">
              <label className="text-[11px] text-dash-text-muted">
                Document Open Password
              </label>
              <div className="relative">
                <input
                  type={showUserPassword ? 'text' : 'password'}
                  value={config.userPassword}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      userPassword: e.target.value,
                    }))
                  }
                  placeholder="Leave empty for no open password"
                  className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 pr-9 text-xs text-dash-text placeholder:text-dash-text-muted/60 focus:border-im-primary focus:outline-none"
                />
                <button
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text"
                >
                  {showUserPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {config.userPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < userStrength.score ? strengthColors[userStrength.score] : 'bg-dash-border'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-dash-text-muted">
                    {userStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Owner Password */}
            <div className="space-y-1">
              <label className="text-[11px] text-dash-text-muted">
                Permissions Password (Owner)
              </label>
              <div className="relative">
                <input
                  type={showOwnerPassword ? 'text' : 'password'}
                  value={config.ownerPassword}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      ownerPassword: e.target.value,
                    }))
                  }
                  placeholder="Leave empty for no permissions password"
                  className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 pr-9 text-xs text-dash-text placeholder:text-dash-text-muted/60 focus:border-im-primary focus:outline-none"
                />
                <button
                  onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text"
                >
                  {showOwnerPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {config.ownerPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < ownerStrength.score ? strengthColors[ownerStrength.score] : 'bg-dash-border'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-dash-text-muted">
                    {ownerStrength.label}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Permissions */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-dash-text">Permissions</h3>

            {/* Printing */}
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-dash-text-muted">
                Printing
              </label>
              <select
                value={config.permissions.printing}
                onChange={(e) =>
                  updatePermission(
                    'printing',
                    e.target.value as PrintPermission,
                  )
                }
                className="rounded-md border border-dash-border bg-dash-surface px-2 py-1 text-[11px] text-dash-text"
              >
                <option value="high-resolution">High Resolution</option>
                <option value="low-resolution">Low Resolution</option>
                <option value="none">Not Allowed</option>
              </select>
            </div>

            {/* Toggle permissions */}
            {(
              [
                ['contentCopying', 'Copy content'],
                ['editingAnnotations', 'Edit annotations'],
                ['fillingForms', 'Fill form fields'],
                ['assembling', 'Assemble document (pages)'],
                ['accessibilityExtraction', 'Accessibility extraction'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-[11px] text-dash-text-muted">
                  {label}
                </label>
                <button
                  onClick={() =>
                    updatePermission(key, !config.permissions[key])
                  }
                  className={`relative h-5 w-9 rounded-full transition ${
                    config.permissions[key] ? 'bg-im-primary' : 'bg-dash-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      config.permissions[key]
                        ? 'translate-x-4'
                        : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}

            {hasRestrictions(config.permissions) && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Some restrictions are in effect
              </p>
            )}
          </section>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-[11px] text-red-400">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dash-border">
          <button
            onClick={handleRemoveSecurity}
            className="rounded-md px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
          >
            Remove Security
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={validationErrors.length > 0}
              className="rounded-md bg-im-primary px-4 py-1.5 text-xs font-medium text-im-primary-fg hover:bg-im-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Security
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
