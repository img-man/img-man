// SPDX-License-Identifier: Apache-2.0
/**
 * CertificateManager Component — Phase 5, Week 19
 *
 * Dialog for managing digital certificates and signatures:
 * - Certificate upload and import
 * - Certificate list with validity status
 * - Digital signature placement controls
 * - Signature appearance configuration
 * - Verification results display
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Upload,
  Trash2,
  Plus,
  ChevronDown,
  FileKey,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Pen,
} from 'lucide-react';
import type {
  DigitalCertificate,
  DigitalSignature,
  SignatureAppearance,
  SignatureVerification,
  CertificateStore,
} from '../types';
import {
  CERTIFICATE_EXTENSIONS,
  DEFAULT_SIGNATURE_APPEARANCE,
} from '../constants';
import {
  isCertificateValid,
  isCertificateExpired,
  daysUntilExpiry,
  isValidCertificateExtension,
  getVerifyStatusLabel,
  getVerifyStatusColor,
  isSignatureTrusted,
  buildSignatureDisplayText,
} from '../engine/certificate-engine';

/* ──────────────────────── Props ──────────────────────── */

interface CertificateManagerProps {
  open: boolean;
  onClose: () => void;
  store: CertificateStore;
  onImportCertificate: (file: File) => void;
  onRemoveCertificate: (certificateId: string) => void;
  onSelectCertificate: (certificateId: string) => void;
  onPlaceSignature: (
    page: number,
    appearance: SignatureAppearance,
    reason?: string,
    location?: string,
  ) => void;
  signatures: DigitalSignature[];
  verifications: SignatureVerification[];
  currentPage: number;
}

/* ──────────────────────── Sub-tabs ──────────────────────── */

type CertTab = 'certificates' | 'sign' | 'verify';

/* ──────────────────────── Component ──────────────────────── */

export default function CertificateManager({
  open,
  onClose,
  store,
  onImportCertificate,
  onRemoveCertificate,
  onSelectCertificate,
  onPlaceSignature,
  signatures,
  verifications,
  currentPage,
}: CertificateManagerProps) {
  const [tab, setTab] = useState<CertTab>('certificates');
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [appearance, setAppearance] = useState<SignatureAppearance>({
    ...DEFAULT_SIGNATURE_APPEARANCE,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCert = useMemo(
    () =>
      store.certificates.find((c) => c.id === store.selectedCertificateId) ??
      null,
    [store],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && isValidCertificateExtension(file.name)) {
        onImportCertificate(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onImportCertificate],
  );

  const handleSign = useCallback(() => {
    if (!selectedCert) return;
    onPlaceSignature(
      currentPage,
      appearance,
      reason || undefined,
      location || undefined,
    );
  }, [
    selectedCert,
    currentPage,
    appearance,
    reason,
    location,
    onPlaceSignature,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      data-testid="certificate-manager"
    >
      <div
        className="w-full max-w-lg rounded-lg shadow-xl"
        style={{
          background: 'var(--dash-surface)',
          border: '1px solid var(--dash-border)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--dash-border)' }}
        >
          <div className="flex items-center gap-2">
            <Shield
              className="h-4 w-4"
              style={{ color: 'var(--im-primary)' }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--dash-text)' }}
            >
              Digital Certificates & Signatures
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--dash-text-muted)' }}
            data-testid="cert-close-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--dash-border)' }}
        >
          {(['certificates', 'sign', 'verify'] as CertTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors"
              style={{
                color:
                  tab === t ? 'var(--im-primary)' : 'var(--dash-text-muted)',
                borderBottom:
                  tab === t
                    ? '2px solid var(--im-primary)'
                    : '2px solid transparent',
              }}
              data-testid={`cert-tab-${t}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="max-h-[400px] overflow-y-auto p-4">
          {/* ═══ Certificates Tab ═══ */}
          {tab === 'certificates' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={CERTIFICATE_EXTENSIONS.join(',')}
                onChange={handleFileSelect}
                data-testid="cert-file-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-3 text-xs transition-colors"
                style={{
                  borderColor: 'var(--dash-border)',
                  color: 'var(--dash-text-muted)',
                }}
                data-testid="cert-import-btn"
              >
                <Upload className="h-4 w-4" />
                Import Certificate ({CERTIFICATE_EXTENSIONS.join(', ')})
              </button>

              {store.certificates.length === 0 && (
                <p
                  className="text-center text-xs py-4"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  No certificates imported yet.
                </p>
              )}

              {store.certificates.map((cert) => {
                const valid = isCertificateValid(cert);
                const expired = isCertificateExpired(cert);
                const days = daysUntilExpiry(cert);
                const isSelected = cert.id === store.selectedCertificateId;

                return (
                  <div
                    key={cert.id}
                    className="cursor-pointer rounded-md border p-3 transition-colors"
                    style={{
                      borderColor: isSelected
                        ? 'var(--im-primary)'
                        : 'var(--dash-border)',
                      background: isSelected
                        ? 'var(--dash-surface-hover)'
                        : 'transparent',
                    }}
                    onClick={() => onSelectCertificate(cert.id)}
                    data-testid={`cert-item-${cert.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {valid ? (
                        <ShieldCheck className="h-4 w-4 text-green-400" />
                      ) : expired ? (
                        <ShieldX className="h-4 w-4 text-red-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-yellow-400" />
                      )}
                      <span
                        className="flex-1 text-xs font-medium"
                        style={{ color: 'var(--dash-text)' }}
                      >
                        {cert.subject}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCertificate(cert.id);
                        }}
                        className="rounded p-0.5 transition-colors hover:text-red-400"
                        style={{ color: 'var(--dash-text-muted)' }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div
                      className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      <span>Issuer: {cert.issuer}</span>
                      <span>Algorithm: {cert.algorithm}</span>
                      <span
                        className={
                          expired
                            ? 'text-red-400'
                            : days < 30
                              ? 'text-yellow-400'
                              : ''
                        }
                      >
                        {expired ? 'Expired' : `Expires in ${days} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ Sign Tab ═══ */}
          {tab === 'sign' && (
            <div className="space-y-3">
              {!selectedCert ? (
                <div
                  className="rounded-md border p-4 text-center"
                  style={{ borderColor: 'var(--dash-border)' }}
                >
                  <AlertCircle
                    className="mx-auto mb-2 h-6 w-6"
                    style={{ color: 'var(--dash-text-muted)' }}
                  />
                  <p
                    className="text-xs"
                    style={{ color: 'var(--dash-text-muted)' }}
                  >
                    Select a certificate first in the Certificates tab.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="rounded-md p-2 text-xs"
                    style={{
                      background: 'var(--dash-surface-hover)',
                      color: 'var(--dash-text)',
                    }}
                  >
                    Signing with: <strong>{selectedCert.subject}</strong>
                  </div>

                  <div>
                    <label
                      className="mb-1 block text-[11px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Document approval"
                      className="w-full rounded-md border px-2 py-1.5 text-xs outline-none"
                      style={{
                        background: 'var(--dash-surface)',
                        borderColor: 'var(--dash-border)',
                        color: 'var(--dash-text)',
                      }}
                      data-testid="cert-reason-input"
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1 block text-[11px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., New York, NY"
                      className="w-full rounded-md border px-2 py-1.5 text-xs outline-none"
                      style={{
                        background: 'var(--dash-surface)',
                        borderColor: 'var(--dash-border)',
                        color: 'var(--dash-text)',
                      }}
                      data-testid="cert-location-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      Appearance
                    </p>
                    {(
                      [
                        'showName',
                        'showDate',
                        'showOrganization',
                        'showLogo',
                      ] as const
                    ).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                        style={{ color: 'var(--dash-text)' }}
                      >
                        <input
                          type="checkbox"
                          checked={appearance[key]}
                          onChange={(e) =>
                            setAppearance((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 rounded"
                        />
                        {key.replace('show', 'Show ')}
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleSign}
                    className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
                    style={{
                      background: 'var(--im-primary)',
                      color: 'var(--im-primary-fg)',
                    }}
                    data-testid="cert-sign-btn"
                  >
                    <Pen className="h-3.5 w-3.5" />
                    Place Signature on Page {currentPage}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ═══ Verify Tab ═══ */}
          {tab === 'verify' && (
            <div className="space-y-3">
              {signatures.length === 0 && verifications.length === 0 && (
                <p
                  className="text-center text-xs py-4"
                  style={{ color: 'var(--dash-text-muted)' }}
                >
                  No signatures to verify.
                </p>
              )}

              {verifications.map((v) => {
                const trusted = isSignatureTrusted(v);
                return (
                  <div
                    key={v.signatureId}
                    className="rounded-md border p-3"
                    style={{ borderColor: 'var(--dash-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      {trusted ? (
                        <ShieldCheck className="h-4 w-4 text-green-400" />
                      ) : v.status === 'invalid' || v.status === 'revoked' ? (
                        <ShieldX className="h-4 w-4 text-red-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-yellow-400" />
                      )}
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--dash-text)' }}
                      >
                        {v.signerName}
                      </span>
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ background: getVerifyStatusColor(v.status) }}
                      >
                        {getVerifyStatusLabel(v.status)}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 space-y-0.5 text-[10px]"
                      style={{ color: 'var(--dash-text-muted)' }}
                    >
                      <p>Signed: {v.signedAt.toLocaleString()}</p>
                      <p>Timestamp valid: {v.timestampValid ? 'Yes' : 'No'}</p>
                      <p>
                        Modified after signing:{' '}
                        {v.modifiedAfterSigning ? 'Yes ⚠️' : 'No'}
                      </p>
                      {v.details && <p>{v.details}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex justify-end border-t px-4 py-3"
          style={{ borderColor: 'var(--dash-border)' }}
        >
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: 'var(--dash-surface-hover)',
              color: 'var(--dash-text)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
