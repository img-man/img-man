// SPDX-License-Identifier: Apache-2.0
/**
 * PdfEditorShell — Main Editor Layout
 *
 * Full-screen PDF editor that orchestrates all sub-components:
 * - Toolbar (top)
 * - ThumbnailSidebar (left)
 * - CanvasViewport (center)
 * - PropertiesPanel (right, when annotation selected)
 * - StatusBar (bottom)
 * - SignatureDialog (modal overlay)
 *
 * This is a Client Component loaded via dynamic import (ssr: false)
 * from tools-client.tsx.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  FileUp,
  Upload,
  FileText,
  Loader2,
  List,
  Layers,
  AlertCircle,
  Search,
  Shield,
  EyeOff,
  BookOpen,
  Info,
  Download,
  Brain,
  Accessibility,
  Users,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

// Hooks
import { usePdfDocument } from '../hooks/usePdfDocument';
import { useZoom } from '../hooks/useZoom';
import { useAnnotations } from '../hooks/useAnnotations';
import { useKeyboard } from '../hooks/useKeyboard';
import { usePageManager } from '../hooks/usePageManager';
import { useAutoSave } from '../hooks/useAutoSave';
import { useFindReplace } from '../hooks/useFindReplace';
import { useCloudSave } from '../hooks/useCloudSave';

// Components
import Toolbar from './Toolbar';
import ThumbnailSidebar from './ThumbnailSidebar';
import CanvasViewport from './CanvasViewport';
import PropertiesPanel from './PropertiesPanel';
import StatusBar from './StatusBar';
import SignatureDialog from './SignatureDialog';
import AnnotationListPanel from './AnnotationListPanel';
import PageManagementBar from './PageManagementBar';
import FindReplaceBar from './FindReplaceBar';
import StampDialog from './StampDialog';
import HeaderFooterDialog from './HeaderFooterDialog';
import LayersPanel from './LayersPanel';
import AlignDistributeBar from './AlignDistributeBar';
import SecurityDialog from './SecurityDialog';
import RedactionPanel from './RedactionPanel';
import BookmarkEditor from './BookmarkEditor';
import MetadataEditor from './MetadataEditor';
import ExportDialog from './ExportDialog';
import AiAssistantPanel from './AiAssistantPanel';
import CertificateManager from './CertificateManager';
import AccessibilityPanel from './AccessibilityPanel';
import CollaborationPanel from './CollaborationPanel';
import CommentThreadPanel from './CommentThreadPanel';
import AiAdvancedPanel from './AiAdvancedPanel';

// Engine
import { exportPdf, downloadPdf } from '../engine/export-engine';
import {
  createSignatureAnnotation,
  createImageAnnotation,
} from '../engine/annotation-serializer';
import {
  createPredefinedStamp,
  createCustomTextStamp,
  createDateStamp,
  createImageStamp,
} from '../engine/stamp-engine';
import { createLinkFromConfig } from '../engine/link-engine';
import { alignAnnotations, distributeAnnotations } from '../engine/alignment';
import { createRedactionMark, markAsApplied } from '../engine/redaction-engine';
import { createIdleTask } from '../engine/ai-document-engine';
import {
  createTranslationOverlay,
  toggleOverlayVisibility,
} from '../engine/ai-translation-engine';
import { createCertificateStore } from '../engine/certificate-engine';

// Phase 6 Engines
import {
  createCollabSession,
  removeCollaborator,
  generateInviteLink,
} from '../engine/collab-engine';
import {
  createCommentThread,
  addReply,
  editComment,
  deleteComment,
  resolveThread,
  reopenThread,
  createActivityEntry,
} from '../engine/comment-engine';
import {
  acceptPiiDetection,
  rejectPiiDetection,
  acceptAllPii,
  createNlCommand,
  markCommandExecuting,
  markCommandCompleted,
  acceptSuggestion as acceptAutofillSuggestion,
  rejectSuggestion as rejectAutofillSuggestion,
} from '../engine/ai-advanced-engine';

// Types & Constants
import type {
  ToolType,
  Annotation,
  PageMeta,
  SidebarTab,
  ExtractedTextBlock,
  StampConfig,
  LinkConfig,
  AlignDirection,
  DistributeDirection,
  SecurityConfig,
  PdfBookmark,
  PdfMetadata,
  ExportConfig,
  RedactionAnnotation,
  AiTaskResult,
  DocumentSummary,
  ExtractedTable,
  ContentAnswer,
  NamedEntity,
  TranslationOverlay,
  DocumentClassification,
  CertificateStore,
  DigitalSignature,
  SignatureVerification,
  SignatureAppearance,
  AccessibilityReport,
  StructureTag,
  ReadingOrderItem,
  AccessibilityIssue,
  CollaborationSession,
  CollaboratorRole,
  CommentThread as CommentThreadType,
  ActivityEntry,
  PiiDetection,
  NlEditCommand,
  SmartAutofillSuggestion,
  GeneratedBookmark,
  SmartCropResult,
} from '../types';
import { ZOOM_PRESETS } from '../constants';
import { LibraryImagePicker, type LibraryAsset } from './LibraryImagePicker';

/* ──────────────────── Props ──────────────────── */

interface PdfEditorShellProps {
  onClose: () => void;
  /** Optional initial PDF file to load */
  initialFile?: File;
  /** Optional initial ArrayBuffer */
  initialBuffer?: ArrayBuffer;
  initialFileName?: string;
}

/* ──────────────────── Drop Zone ──────────────────── */

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === 'application/pdf') {
        onFile(file);
      }
    },
    [onFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile],
  );

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`max-w-md w-full rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/5 scale-[1.02]'
            : 'border-dash-border hover:border-[var(--im-primary)]/50 hover:bg-dash-surface-hover'
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--im-primary)]/10">
          <FileText className="h-8 w-8 text-[var(--im-primary)]" />
        </div>
        <h3 className="text-base font-semibold text-dash-text mb-1">
          Open a PDF
        </h3>
        <p className="text-sm text-dash-text-muted mb-6">
          Drag & drop a PDF file here, or click to browse
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-semibold text-[var(--im-primary-fg)] hover:brightness-110 transition"
        >
          <Upload className="h-4 w-4" />
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

/* ──────────────────── Loading Overlay ──────────────────── */

function LoadingOverlay({
  progress,
  fileName,
}: {
  progress: number;
  fileName: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center bg-dash-surface">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 text-[var(--im-primary)] animate-spin mx-auto" />
        <div>
          <p className="text-sm font-medium text-dash-text">Loading PDF</p>
          <p className="text-xs text-dash-text-muted">{fileName}</p>
        </div>
        <div className="w-48 mx-auto">
          <div className="h-1.5 rounded-full bg-dash-border overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--im-primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-dash-text-muted mt-1 block">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Main Shell ──────────────────── */

export default function PdfEditorShell({
  onClose,
  initialFile,
  initialBuffer,
  initialFileName,
}: PdfEditorShellProps) {
  // ─── Core Hooks ───
  const pdf = usePdfDocument();
  const zoomCtrl = useZoom();
  const annotCtrl = useAnnotations();

  // ─── Local State ───
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [currentPage, setCurrentPage] = useState(1);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarTab, setLeftSidebarTab] =
    useState<SidebarTab>('thumbnails');
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // ─── Phase 3 State ───
  const [stampDialogOpen, setStampDialogOpen] = useState(false);
  const [headerFooterDialogOpen, setHeaderFooterDialogOpen] = useState(false);
  const [extractedText, setExtractedText] = useState<
    Map<number, ExtractedTextBlock[]>
  >(new Map());
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>(
    [],
  );
  const [clipboard, setClipboard] = useState<Annotation[]>([]);

  // ─── Phase 4 State ───
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<PdfBookmark[]>([]);
  const [documentMetadata, setDocumentMetadata] = useState<
    PdfMetadata | undefined
  >(undefined);

  // ─── Phase 5 State ───
  const [summaryTask, setSummaryTask] =
    useState<AiTaskResult<DocumentSummary>>(createIdleTask<DocumentSummary>());
  const [tablesTask, setTablesTask] =
    useState<AiTaskResult<ExtractedTable[]>>(
      createIdleTask<ExtractedTable[]>(),
    );
  const [qaTask, setQaTask] =
    useState<AiTaskResult<ContentAnswer>>(createIdleTask<ContentAnswer>());
  const [entitiesTask, setEntitiesTask] =
    useState<AiTaskResult<NamedEntity[]>>(createIdleTask<NamedEntity[]>());
  const [translationOverlay, setTranslationOverlay] =
    useState<TranslationOverlay | null>(null);
  const [classification, setClassification] =
    useState<DocumentClassification | null>(null);
  const [certificateManagerOpen, setCertificateManagerOpen] = useState(false);
  const [certificateStore, setCertificateStore] = useState<CertificateStore>(
    createCertificateStore(),
  );
  const [digitalSignatures, setDigitalSignatures] = useState<
    DigitalSignature[]
  >([]);
  const [signatureVerifications, setSignatureVerifications] = useState<
    SignatureVerification[]
  >([]);
  const [accessibilityReport, setAccessibilityReport] =
    useState<AccessibilityReport | null>(null);
  const [structureTags, setStructureTags] = useState<StructureTag[]>([]);
  const [readingOrder, setReadingOrder] = useState<ReadingOrderItem[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  // ─── Phase 6 State ───
  const [collabSession, setCollabSession] =
    useState<CollaborationSession | null>(null);
  const [currentCollabId, setCurrentCollabId] = useState<string>('');
  const [commentThreads, setCommentThreads] = useState<CommentThreadType[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [piiDetections, setPiiDetections] = useState<PiiDetection[]>([]);
  const [nlCommands, setNlCommands] = useState<NlEditCommand[]>([]);
  const [autofillSuggestions, setAutofillSuggestions] = useState<
    SmartAutofillSuggestion[]
  >([]);
  const [generatedBookmarks, setGeneratedBookmarks] = useState<
    GeneratedBookmark[]
  >([]);
  const [smartCropResults, setSmartCropResults] = useState<SmartCropResult[]>(
    [],
  );
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // File input ref for image picker
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  // ─── Page Manager Hook ───
  const pageManager = usePageManager(
    useCallback(
      () => (pdf.originalBytes ? new Uint8Array(pdf.originalBytes) : null),
      [pdf.originalBytes],
    ),
    useCallback(
      (bytes: Uint8Array, _newMeta: PageMeta[]) => {
        pdf.loadBuffer(bytes.buffer as ArrayBuffer, pdf.fileName);
        setIsDirty(true);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [pdf.fileName],
    ),
    useCallback(() => pdf.pageMetadata, [pdf.pageMetadata]),
    useCallback(() => annotCtrl.annotations, [annotCtrl.annotations]),
    useCallback(
      (anns: Map<number, Annotation[]>) => annotCtrl.setAnnotations(anns),
      [annotCtrl],
    ),
  );

  // ─── Auto-Save Hook ───
  const autoSave = useAutoSave(
    pdf.isLoaded,
    isDirty,
    pdf.originalBytes ? new Uint8Array(pdf.originalBytes) : null,
    pdf.fileName,
    pdf.fileSize,
    pdf.totalPages,
    annotCtrl.annotations,
    pdf.pageMetadata,
    currentPage,
    zoomCtrl.zoom,
  );

  // ─── Find & Replace Hook ───
  const findReplace = useFindReplace(extractedText);

  // ─── Cloud Save Hook ───
  const cloudSave = useCloudSave(
    pdf.isLoaded,
    isDirty,
    pdf.originalBytes ? new Uint8Array(pdf.originalBytes) : null,
    annotCtrl.annotations,
    pdf.pageMetadata,
    pdf.fileName,
    '', // orgId — wired when org context available
    '', // documentId — wired when document persisted
  );

  // ─── Load initial file if provided ───
  useEffect(() => {
    if (initialFile) {
      pdf.loadFile(initialFile);
    } else if (initialBuffer && initialFileName) {
      pdf.loadBuffer(initialBuffer, initialFileName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Tool change handler ───
  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    // Deselect when switching away from select tool
    if (tool !== 'select') {
      setSelectedAnnotation(null);
      setRightPanelOpen(false);
    }
  }, []);

  // ─── Page navigation ───
  const goPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(pdf.totalPages, p + 1));
  }, [pdf.totalPages]);

  // ─── Annotation handlers ───
  const handleAnnotationSelect = useCallback(
    (annotationId: string | null) => {
      if (!annotationId) {
        setSelectedAnnotation(null);
        setRightPanelOpen(false);
        return;
      }
      const result = annotCtrl.findAnnotation(annotationId);
      if (result) {
        setSelectedAnnotation(result.annotation);
        setRightPanelOpen(true);
      }
    },
    [annotCtrl],
  );

  const handleAnnotationUpdate = useCallback(
    (id: string, changes: Partial<Annotation>) => {
      const result = annotCtrl.findAnnotation(id);
      if (result) {
        annotCtrl.updateAnnotation(result.page, id, changes);
        // Update local selection
        const updated = { ...result.annotation, ...changes } as Annotation;
        setSelectedAnnotation(updated);
        setIsDirty(true);
      }
    },
    [annotCtrl],
  );

  const handleAnnotationDelete = useCallback(
    (id: string) => {
      const result = annotCtrl.findAnnotation(id);
      if (result) {
        annotCtrl.removeAnnotation(result.page, id);
        setSelectedAnnotation(null);
        setRightPanelOpen(false);
        setIsDirty(true);
      }
    },
    [annotCtrl],
  );

  const handleAnnotationDuplicate = useCallback(
    (annotation: Annotation) => {
      const dup = {
        ...annotation,
        id: `${annotation.id}-copy-${Date.now()}`,
        x: annotation.x + 20,
        y: annotation.y + 20,
        name: annotation.name ? `${annotation.name} (copy)` : undefined,
      };
      annotCtrl.addAnnotation(dup);
      setIsDirty(true);
    },
    [annotCtrl],
  );

  // ─── Signature handler ───
  const handleSignatureConfirm = useCallback(
    (dataUrl: string) => {
      const sig = createSignatureAnnotation(
        currentPage,
        100,
        100,
        dataUrl,
        'drawn',
        { width: 200, height: 60 },
      );
      annotCtrl.addAnnotation(sig);
      setIsDirty(true);
      setActiveTool('select');
    },
    [currentPage, annotCtrl],
  );

  // ─── Image picker handler ───
  const handleOpenImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  // ─── Library image picker handler ───
  const handleOpenLibraryPicker = useCallback(() => {
    setShowLibraryPicker(true);
  }, []);

  const handleLibraryImageSelect = useCallback(
    (asset: LibraryAsset) => {
      const img = createImageAnnotation(currentPage, 100, 100, asset.url, {
        width: asset.width ? Math.min(asset.width, 400) : 200,
        height: asset.height ? Math.min(asset.height, 400) : 200,
        lockAspect: true,
      });
      annotCtrl.addAnnotation(img);
      setIsDirty(true);
      setActiveTool('select');
    },
    [currentPage, annotCtrl],
  );

  // ─── Annotation removed handler (from eraser) ───
  const handleAnnotationRemoved = useCallback(
    (annotationId: string) => {
      const result = annotCtrl.findAnnotation(annotationId);
      if (result) {
        annotCtrl.removeAnnotation(result.page, annotationId);
        setIsDirty(true);
      }
    },
    [annotCtrl],
  );

  // ─── Navigate to annotation (from AnnotationListPanel) ───
  const handleNavigateToAnnotation = useCallback(
    (page: number, annotationId: string) => {
      setCurrentPage(page);
      handleAnnotationSelect(annotationId);
    },
    [handleAnnotationSelect],
  );

  // ─── Fullscreen toggle ───
  const handleToggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullScreen(false);
    }
  }, []);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const img = createImageAnnotation(
          currentPage,
          100,
          100,
          reader.result as string,
          { width: 200, height: 200, lockAspect: true },
        );
        annotCtrl.addAnnotation(img);
        setIsDirty(true);
        setActiveTool('select');
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [currentPage, annotCtrl],
  );

  // ─── Stamp handler ───
  const handleStampCreate = useCallback(
    (config: StampConfig) => {
      let stamp: Annotation | null = null;
      const page = currentPage;
      const pageMeta = pdf.pageMetadata[currentPage - 1];

      switch (config.type) {
        case 'predefined':
          stamp = createPredefinedStamp(config.label, page, pageMeta);
          break;
        case 'custom-text':
          stamp = createCustomTextStamp(
            page,
            config.label,
            config.color,
            config.fontSize,
            pageMeta,
          );
          break;
        case 'date':
          stamp = createDateStamp(
            page,
            config.color,
            config.fontSize,
            pageMeta,
          );
          break;
        case 'custom-image':
          if (config.imageSrc) {
            stamp = createImageStamp(page, config.imageSrc, 200, 100, pageMeta);
          }
          break;
      }

      if (stamp) {
        annotCtrl.addAnnotation(stamp);
        setIsDirty(true);
        setActiveTool('select');
      }
      setStampDialogOpen(false);
    },
    [currentPage, annotCtrl, pdf.pageMetadata],
  );

  // ─── Link creation handler ───
  const handleLinkCreate = useCallback(
    (config: LinkConfig) => {
      const link = createLinkFromConfig(currentPage, 100, 100, 200, 30, config);
      annotCtrl.addAnnotation(link);
      setIsDirty(true);
      setActiveTool('select');
    },
    [currentPage, annotCtrl],
  );

  // ─── Alignment handlers ───
  const handleAlign = useCallback(
    (direction: AlignDirection) => {
      const pageAnns = annotCtrl.annotations.get(currentPage) ?? [];
      const selected = pageAnns.filter((a) =>
        selectedAnnotationIds.includes(a.id),
      );
      if (selected.length === 0) return;
      const pageMeta = pdf.pageMetadata[currentPage - 1];
      const updated = alignAnnotations(selected, direction, pageMeta);
      for (const ann of updated) {
        annotCtrl.updateAnnotation(currentPage, ann.id, { x: ann.x, y: ann.y });
      }
      setIsDirty(true);
    },
    [annotCtrl, currentPage, selectedAnnotationIds, pdf.pageMetadata],
  );

  const handleDistribute = useCallback(
    (direction: DistributeDirection) => {
      const pageAnns = annotCtrl.annotations.get(currentPage) ?? [];
      const selected = pageAnns.filter((a) =>
        selectedAnnotationIds.includes(a.id),
      );
      if (selected.length < 3) return;
      const updated = distributeAnnotations(selected, direction);
      for (const ann of updated) {
        annotCtrl.updateAnnotation(currentPage, ann.id, { x: ann.x, y: ann.y });
      }
      setIsDirty(true);
    },
    [annotCtrl, currentPage, selectedAnnotationIds],
  );

  // ─── Copy / Paste handlers ───
  const handleCopy = useCallback(() => {
    const pageAnns = annotCtrl.annotations.get(currentPage) ?? [];
    const selected = pageAnns.filter((a) =>
      selectedAnnotationIds.includes(a.id),
    );
    if (selected.length > 0) setClipboard(selected);
  }, [annotCtrl, currentPage, selectedAnnotationIds]);

  const handlePaste = useCallback(() => {
    for (const ann of clipboard) {
      const dup: Annotation = {
        ...ann,
        id: `${ann.id}-paste-${Date.now()}`,
        x: ann.x + 20,
        y: ann.y + 20,
        page: currentPage,
      } as Annotation;
      annotCtrl.addAnnotation(dup);
    }
    if (clipboard.length > 0) setIsDirty(true);
  }, [clipboard, currentPage, annotCtrl]);

  // ─── Phase 4 Handlers ───
  const handleApplyRedaction = useCallback(
    (id: string) => {
      const result = annotCtrl.findAnnotation(id);
      if (result && result.annotation.kind === 'redaction') {
        const applied = markAsApplied(result.annotation as RedactionAnnotation);
        annotCtrl.updateAnnotation(result.page, id, applied);
        setIsDirty(true);
      }
    },
    [annotCtrl],
  );

  const handleApplyAllRedactions = useCallback(() => {
    for (const [page, anns] of annotCtrl.annotations) {
      for (const ann of anns) {
        if (ann.kind === 'redaction' && !(ann as RedactionAnnotation).applied) {
          const applied = markAsApplied(ann as RedactionAnnotation);
          annotCtrl.updateAnnotation(page, ann.id, applied);
        }
      }
    }
    setIsDirty(true);
  }, [annotCtrl]);

  const handleApplySelectedRedactions = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        handleApplyRedaction(id);
      }
    },
    [handleApplyRedaction],
  );

  const handleSecurityApply = useCallback((config: SecurityConfig) => {
    setSecurityConfig(config);
    setIsDirty(true);
  }, []);

  const handleMetadataApply = useCallback((metadata: PdfMetadata) => {
    setDocumentMetadata(metadata);
    setIsDirty(true);
  }, []);

  const handleAdvancedExport = useCallback(
    async (config: ExportConfig) => {
      if (!pdf.originalBytes || !pdf.pageMetadata.length) return;
      setIsExporting(true);
      try {
        const bytes = await exportPdf(
          pdf.originalBytes,
          annotCtrl.annotations,
          pdf.pageMetadata,
        );
        downloadPdf(
          bytes,
          pdf.fileName.replace(/\.pdf$/i, '') + `_${config.format}.pdf`,
        );
        setIsDirty(false);
        setLastSaved(new Date());
        setExportDialogOpen(false);
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setIsExporting(false);
      }
    },
    [pdf.originalBytes, pdf.pageMetadata, pdf.fileName, annotCtrl.annotations],
  );

  const handleAddRedaction = useCallback(() => {
    const pageMeta = pdf.pageMetadata[currentPage - 1];
    if (!pageMeta) return;
    const mark = createRedactionMark(
      currentPage,
      pageMeta.width / 4,
      pageMeta.height / 4,
      pageMeta.width / 2,
      30,
    );
    annotCtrl.addAnnotation(mark);
    setIsDirty(true);
  }, [currentPage, pdf.pageMetadata, annotCtrl]);

  // Collect all redaction annotations across all pages
  const allRedactions: RedactionAnnotation[] = [];
  for (const [, anns] of annotCtrl.annotations) {
    for (const ann of anns) {
      if (ann.kind === 'redaction')
        allRedactions.push(ann as RedactionAnnotation);
    }
  }

  // ─── Phase 5 AI Handlers (stubs — wire to actual AI service) ───
  const handleSummarize = useCallback(() => {
    setSummaryTask((prev) => ({
      ...prev,
      status: 'processing',
      startedAt: new Date(),
      completedAt: null,
    }));
    // TODO: call Vertex AI via server action
  }, []);

  const handleExtractTables = useCallback((_page: number) => {
    setTablesTask((prev) => ({
      ...prev,
      status: 'processing',
      startedAt: new Date(),
      completedAt: null,
    }));
    // TODO: call Vertex AI via server action
  }, []);

  const handleAskQuestion = useCallback((_question: string) => {
    setQaTask((prev) => ({
      ...prev,
      status: 'processing',
      startedAt: new Date(),
      completedAt: null,
    }));
    // TODO: call Vertex AI via server action
  }, []);

  const handleExtractEntities = useCallback((_page: number) => {
    setEntitiesTask((prev) => ({
      ...prev,
      status: 'processing',
      startedAt: new Date(),
      completedAt: null,
    }));
    // TODO: call Vertex AI via server action
  }, []);

  const handleTranslate = useCallback(
    (sourceLang: string, targetLang: string) => {
      setTranslationOverlay(createTranslationOverlay(sourceLang, targetLang));
      // TODO: call Vertex AI via server action
    },
    [],
  );

  const handleToggleTranslation = useCallback(() => {
    setTranslationOverlay((prev) =>
      prev ? toggleOverlayVisibility(prev) : null,
    );
  }, []);

  // ─── Phase 5 Certificate Handlers ───
  const handleImportCertificate = useCallback((_file: File) => {
    // TODO: parse certificate via server action and add to store
  }, []);

  const handleRemoveCertificate = useCallback((certId: string) => {
    setCertificateStore((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((c) => c.id !== certId),
      selectedCertificateId:
        prev.selectedCertificateId === certId
          ? null
          : prev.selectedCertificateId,
    }));
  }, []);

  const handleSelectCertificate = useCallback((certId: string) => {
    setCertificateStore((prev) => ({ ...prev, selectedCertificateId: certId }));
  }, []);

  const handlePlaceSignature = useCallback(
    (
      _page: number,
      _appearance: SignatureAppearance,
      _reason?: string,
      _location?: string,
    ) => {
      // TODO: create digital signature via server action
    },
    [],
  );

  // ─── Phase 5 Accessibility Handlers ───
  const handleRunAudit = useCallback(() => {
    setIsAuditing(true);
    // TODO: run full audit
    setIsAuditing(false);
  }, []);

  const handleFixIssue = useCallback((_issue: AccessibilityIssue) => {
    // TODO: auto-fix accessibility issues
  }, []);

  const handleSelectTag = useCallback((_tagId: string) => {
    // TODO: scroll to and highlight the tag region
  }, []);

  const handleUpdateTagAltText = useCallback(
    (_tagId: string, _altText: string) => {
      // TODO: update tag alt text in structure tags
    },
    [],
  );

  const handleMoveReadingOrderUp = useCallback((tagId: string) => {
    setReadingOrder((prev) => {
      const idx = prev.findIndex((o) => o.tagId === tagId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((item, i) => ({ ...item, order: i + 1 }));
    });
  }, []);

  const handleMoveReadingOrderDown = useCallback((tagId: string) => {
    setReadingOrder((prev) => {
      const idx = prev.findIndex((o) => o.tagId === tagId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((item, i) => ({ ...item, order: i + 1 }));
    });
  }, []);

  const handleRemoveFromReadingOrder = useCallback((tagId: string) => {
    setReadingOrder((prev) =>
      prev
        .filter((o) => o.tagId !== tagId)
        .map((item, i) => ({ ...item, order: i + 1 })),
    );
  }, []);

  // ─── Phase 6 Collaboration Handlers ───
  const handleCreateCollabSession = useCallback(() => {
    const session = createCollabSession('current-doc-id', {
      userId: 'current-user',
      displayName: 'Me',
    });
    setCollabSession(session);
    setCurrentCollabId(session.hostId);
  }, []);

  const handleLeaveCollabSession = useCallback(() => {
    setCollabSession(null);
    setCurrentCollabId('');
  }, []);

  const handleGenerateInvite = useCallback(() => {
    if (!collabSession) return;
    const updated = generateInviteLink(collabSession, window.location.origin);
    setCollabSession(updated);
  }, [collabSession]);

  const handleChangeCollabRole = useCallback(
    (collabId: string, role: CollaboratorRole) => {
      if (!collabSession) return;
      const idx = collabSession.collaborators.findIndex(
        (c) => c.id === collabId,
      );
      if (idx < 0) return;
      const updated = {
        ...collabSession,
        collaborators: [...collabSession.collaborators],
      };
      updated.collaborators[idx] = { ...updated.collaborators[idx], role };
      setCollabSession(updated);
    },
    [collabSession],
  );

  const handleKickCollaborator = useCallback(
    (collabId: string) => {
      if (!collabSession) return;
      setCollabSession(removeCollaborator(collabSession, collabId));
    },
    [collabSession],
  );

  // ─── Phase 6 Comment Handlers ───
  const handleAddCommentThread = useCallback(
    (page: number, position: { x: number; y: number }, content: string) => {
      const result = createCommentThread(page, position, {
        authorId: 'current-user',
        authorName: 'Me',
        content,
      });
      if (result.thread) {
        setCommentThreads((prev) => [...prev, result.thread]);
        setActivityLog((prev) => [
          ...prev,
          createActivityEntry(
            'comment-added',
            { userId: 'current-user', userName: 'Me' },
            `Added a comment on page ${page}`,
            page,
          ),
        ]);
      }
    },
    [],
  );

  const handleReplyToThread = useCallback(
    (threadId: string, content: string) => {
      setCommentThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const result = addReply(t, {
            authorId: 'current-user',
            authorName: 'Me',
            content,
          });
          return result.thread;
        }),
      );
    },
    [],
  );

  const handleEditComment = useCallback(
    (threadId: string, commentId: string, content: string) => {
      setCommentThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const result = editComment(t, commentId, content);
          return result.thread;
        }),
      );
    },
    [],
  );

  const handleDeleteThreadComment = useCallback(
    (threadId: string, commentId: string) => {
      setCommentThreads((prev) => {
        const updated: CommentThreadType[] = [];
        for (const t of prev) {
          if (t.id !== threadId) {
            updated.push(t);
            continue;
          }
          const result = deleteComment(t, commentId);
          if (result.thread) updated.push(result.thread);
          // null means last comment was deleted — remove entire thread
        }
        return updated;
      });
    },
    [],
  );

  const handleResolveThread = useCallback((threadId: string) => {
    setCommentThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? resolveThread(t, 'current-user') : t,
      ),
    );
  }, []);

  const handleReopenThread = useCallback((threadId: string) => {
    setCommentThreads((prev) =>
      prev.map((t) => (t.id === threadId ? reopenThread(t) : t)),
    );
  }, []);

  // ─── Phase 6 AI Advanced Handlers ───
  const handleScanPii = useCallback(() => {
    setIsAiProcessing(true);
    // TODO: call Vertex AI PII detection via server action
    setIsAiProcessing(false);
  }, []);

  const handleAcceptPii = useCallback((id: string) => {
    setPiiDetections((prev) => acceptPiiDetection(prev, id));
  }, []);

  const handleRejectPii = useCallback((id: string) => {
    setPiiDetections((prev) => rejectPiiDetection(prev, id));
  }, []);

  const handleAcceptAllPiiDetections = useCallback(() => {
    setPiiDetections((prev) => acceptAllPii(prev));
  }, []);

  const handleExecuteNlCommand = useCallback(
    (rawInput: string) => {
      const cmd = createNlCommand(rawInput);
      const executing = markCommandExecuting(cmd, rawInput);
      setNlCommands((prev) => [...prev, executing]);
      // TODO: call Vertex AI NL editing via server action, then markCommandCompleted
      setTimeout(() => {
        setNlCommands((prev) =>
          prev.map((c) =>
            c.id === executing.id
              ? markCommandCompleted(c, 'Command processed (stub)')
              : c,
          ),
        );
      }, 1000);
    },
    [currentPage, pdf.totalPages],
  );

  const handleAcceptAutofill = useCallback((fieldId: string) => {
    setAutofillSuggestions((prev) => acceptAutofillSuggestion(prev, fieldId));
  }, []);

  const handleRejectAutofill = useCallback((fieldId: string) => {
    setAutofillSuggestions((prev) => rejectAutofillSuggestion(prev, fieldId));
  }, []);

  const handleApplyGeneratedBookmarks = useCallback(() => {
    // Merge generated bookmarks into existing bookmarks list
    const newBookmarks: PdfBookmark[] = generatedBookmarks.map((gb, i) => ({
      id: `gen-bm-${i}`,
      title: gb.title,
      page: gb.page,
      level: gb.level,
      yOffset: 0,
      children: [],
      expanded: false,
    }));
    setBookmarks((prev) => [...prev, ...newBookmarks]);
    setGeneratedBookmarks([]);
  }, [generatedBookmarks]);

  const handleApplySmartCrop = useCallback((_page: number) => {
    // TODO: apply crop via pdf-lib
  }, []);

  // ─── Export handler ───
  const handleExport = useCallback(async () => {
    if (!pdf.originalBytes || !pdf.pageMetadata.length) return;
    setIsExporting(true);
    try {
      const bytes = await exportPdf(
        pdf.originalBytes,
        annotCtrl.annotations,
        pdf.pageMetadata,
      );
      downloadPdf(bytes, pdf.fileName.replace(/\.pdf$/i, '') + '_edited.pdf');
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [
    pdf.originalBytes,
    pdf.pageMetadata,
    pdf.fileName,
    annotCtrl.annotations,
  ]);

  // ─── Save handler (saves to local — could be extended to server) ───
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // For now save is the same as export, but this could save to server
      await handleExport();
    } finally {
      setIsSaving(false);
    }
  }, [handleExport]);

  // ─── Compute current page meta ───
  const currentPageMeta: PageMeta | undefined =
    pdf.pageMetadata[currentPage - 1];

  // ─── Keyboard shortcuts ───
  useKeyboard({
    isActive: pdf.isLoaded,
    onUndo: annotCtrl.undo,
    onRedo: annotCtrl.redo,
    onSave: handleSave,
    onDelete: () => {
      if (selectedAnnotation) handleAnnotationDelete(selectedAnnotation.id);
    },
    onDeselect: () => {
      setActiveTool('select');
      setSelectedAnnotation(null);
      setRightPanelOpen(false);
    },
    onZoomIn: zoomCtrl.zoomIn,
    onZoomOut: zoomCtrl.zoomOut,
    onFitPage: () =>
      zoomCtrl.fitPage(
        800,
        600,
        currentPageMeta?.width ?? 612,
        currentPageMeta?.height ?? 792,
      ),
    onActualSize: zoomCtrl.actualSize,
    onPrevPage: goPrevPage,
    onNextPage: goNextPage,
    onToolChange: handleToolChange,
    onFindReplace: findReplace.toggle,
    onSelectAll: () => {
      // TODO: Select all annotations on current page
    },
    onFirstPage: () => setCurrentPage(1),
    onLastPage: () => setCurrentPage(pdf.totalPages),
  });

  // ─── Render ───
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-dash-surface">
      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Library image picker dialog */}
      <LibraryImagePicker
        open={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onSelect={handleLibraryImageSelect}
        orgId={''}
      />

      {/* Header / Toolbar */}
      <div className="flex items-center bg-dash-surface border-b border-dash-border">
        {/* Close button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition border-r border-dash-border"
          title="Close Editor"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Close</span>
        </button>

        {/* File name */}
        {pdf.isLoaded && (
          <div className="flex items-center gap-1.5 px-3 border-r border-dash-border">
            <FileText className="h-3.5 w-3.5 text-dash-text-muted" />
            <span className="text-xs font-medium text-dash-text truncate max-w-[200px]">
              {pdf.fileName}
            </span>
          </div>
        )}

        {/* Open another file */}
        {pdf.isLoaded && (
          <button
            onClick={() => {
              pdf.unload();
              annotCtrl.clearAll();
              setSelectedAnnotation(null);
              setRightPanelOpen(false);
              setIsDirty(false);
            }}
            className="flex items-center gap-1 px-2 py-1.5 ml-1 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            title="Open Another File"
          >
            <FileUp className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Phase 4 Quick Actions */}
        {pdf.isLoaded && (
          <div className="flex items-center gap-0.5 ml-1 border-l border-dash-border pl-2">
            <button
              onClick={() => setSecurityDialogOpen(true)}
              title="Document Security"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMetadataEditorOpen(true)}
              title="Document Metadata"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleAddRedaction}
              title="Add Redaction"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setExportDialogOpen(true)}
              title="Export Options"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCertificateManagerOpen(true)}
              title="Digital Signatures"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover rounded transition"
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1" />
      </div>

      {/* Toolbar (only when document is loaded) */}
      {pdf.isLoaded && (
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          canUndo={annotCtrl.canUndo}
          canRedo={annotCtrl.canRedo}
          onUndo={annotCtrl.undo}
          onRedo={annotCtrl.redo}
          onSave={handleSave}
          onExport={handleExport}
          isSaving={isSaving}
          isExporting={isExporting}
          onOpenSignature={() => setSignatureOpen(true)}
          onOpenImagePicker={handleOpenImagePicker}
          onOpenLibraryPicker={handleOpenLibraryPicker}
          onOpenStampDialog={() => setStampDialogOpen(true)}
          onOpenHeaderFooterDialog={() => setHeaderFooterDialogOpen(true)}
          onOpenFindReplace={findReplace.toggle}
          zoom={zoomCtrl.zoom}
          zoomLabel={zoomCtrl.zoomLabel}
          onZoomIn={zoomCtrl.zoomIn}
          onZoomOut={zoomCtrl.zoomOut}
          onFitWidth={() =>
            zoomCtrl.fitWidth(800, currentPageMeta?.width ?? 612)
          }
          onFitPage={() =>
            zoomCtrl.fitPage(
              800,
              600,
              currentPageMeta?.width ?? 612,
              currentPageMeta?.height ?? 792,
            )
          }
          onActualSize={zoomCtrl.actualSize}
          zoomPresets={ZOOM_PRESETS}
          onSetZoom={zoomCtrl.setZoom}
          currentPage={currentPage}
          totalPages={pdf.totalPages}
          onPrevPage={goPrevPage}
          onNextPage={goNextPage}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {pdf.isLoaded && (
          <div className="flex shrink-0">
            {/* Sidebar tab buttons */}
            {leftSidebarOpen && (
              <div className="flex flex-col items-center gap-1 border-r border-dash-border bg-dash-surface px-1 py-2">
                <button
                  onClick={() => setLeftSidebarTab('thumbnails')}
                  title="Pages"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'thumbnails'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('annotations')}
                  title="Annotations"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'annotations'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('layers')}
                  title="Layers"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'layers'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('bookmarks')}
                  title="Bookmarks"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'bookmarks'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('redactions')}
                  title="Redactions"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'redactions'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('ai-assistant')}
                  title="AI Assistant"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'ai-assistant'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('accessibility')}
                  title="Accessibility"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'accessibility'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Accessibility className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('collaboration')}
                  title="Collaboration"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'collaboration'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Users className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('comments')}
                  title="Comments"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'comments'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLeftSidebarTab('ai-advanced')}
                  title="AI Advanced"
                  className={`rounded-lg p-1.5 transition-colors ${
                    leftSidebarTab === 'ai-advanced'
                      ? 'bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'text-dash-text-muted hover:bg-dash-surface-hover'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Sidebar content */}
            {leftSidebarTab === 'thumbnails' ? (
              <ThumbnailSidebar
                isOpen={leftSidebarOpen}
                onToggle={() => setLeftSidebarOpen(!leftSidebarOpen)}
                totalPages={pdf.totalPages}
                pageMetadata={pdf.pageMetadata}
                renderer={pdf.renderer}
                currentPage={currentPage}
                onPageClick={setCurrentPage}
                onReorderPage={pageManager.handleReorder}
                onRotatePage={pageManager.handleRotate}
                onDuplicatePage={pageManager.handleDuplicate}
                onDeletePage={pageManager.handleDelete}
              />
            ) : leftSidebarTab === 'annotations' ? (
              leftSidebarOpen ? (
                <div className="w-[240px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <AnnotationListPanel
                    annotations={annotCtrl.annotations}
                    totalPages={pdf.totalPages}
                    currentPage={currentPage}
                    onNavigateToAnnotation={handleNavigateToAnnotation}
                    onUpdateAnnotation={(id, changes) => {
                      const result = annotCtrl.findAnnotation(id);
                      if (result)
                        annotCtrl.updateAnnotation(result.page, id, changes);
                    }}
                    onDeleteAnnotation={handleAnnotationDelete}
                    selectedAnnotationId={selectedAnnotation?.id ?? null}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'layers' ? (
              leftSidebarOpen ? (
                <div className="w-[240px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <LayersPanel
                    annotations={annotCtrl.annotations.get(currentPage) ?? []}
                    selectedAnnotationId={selectedAnnotation?.id ?? null}
                    onSelectAnnotation={(id) => handleAnnotationSelect(id)}
                    onUpdateAnnotation={(id, changes) => {
                      annotCtrl.updateAnnotation(currentPage, id, changes);
                    }}
                    onReorderAnnotation={(fromIndex, toIndex) => {
                      const pageAnns = [
                        ...(annotCtrl.annotations.get(currentPage) ?? []),
                      ];
                      const [moved] = pageAnns.splice(fromIndex, 1);
                      if (moved) {
                        pageAnns.splice(toIndex, 0, moved);
                        const newMap = new Map(annotCtrl.annotations);
                        newMap.set(currentPage, pageAnns);
                        annotCtrl.setAnnotations(newMap);
                      }
                    }}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : (leftSidebarTab as string) === 'bookmarks' ? (
              leftSidebarOpen ? (
                <div className="w-[260px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <BookmarkEditor
                    bookmarks={bookmarks}
                    onChange={setBookmarks}
                    totalPages={pdf.totalPages}
                    onNavigateToPage={setCurrentPage}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : (leftSidebarTab as string) === 'redactions' ? (
              leftSidebarOpen ? (
                <div className="w-[260px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <RedactionPanel
                    redactions={allRedactions}
                    onSelectRedaction={(id) => handleAnnotationSelect(id)}
                    onDeleteRedaction={handleAnnotationDelete}
                    onUpdateRedaction={(id, update) => {
                      const result = annotCtrl.findAnnotation(id);
                      if (result)
                        annotCtrl.updateAnnotation(result.page, id, update);
                    }}
                    onApplyAll={handleApplyAllRedactions}
                    onApplySelected={handleApplySelectedRedactions}
                    selectedId={selectedAnnotation?.id}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'ai-assistant' ? (
              leftSidebarOpen ? (
                <div className="w-[280px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <AiAssistantPanel
                    onSummarize={handleSummarize}
                    onExtractTables={handleExtractTables}
                    onAskQuestion={handleAskQuestion}
                    onExtractEntities={handleExtractEntities}
                    onTranslate={handleTranslate}
                    onToggleTranslation={handleToggleTranslation}
                    summaryTask={summaryTask}
                    tablesTask={tablesTask}
                    qaTask={qaTask}
                    entitiesTask={entitiesTask}
                    translationOverlay={translationOverlay}
                    classification={classification}
                    currentPage={currentPage}
                    totalPages={pdf.totalPages}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'accessibility' ? (
              leftSidebarOpen ? (
                <div className="w-[280px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <AccessibilityPanel
                    onRunAudit={handleRunAudit}
                    onFixIssue={handleFixIssue}
                    onSelectTag={handleSelectTag}
                    onUpdateTagAltText={handleUpdateTagAltText}
                    onMoveReadingOrderUp={handleMoveReadingOrderUp}
                    onMoveReadingOrderDown={handleMoveReadingOrderDown}
                    onRemoveFromReadingOrder={handleRemoveFromReadingOrder}
                    report={accessibilityReport}
                    tags={structureTags}
                    readingOrder={readingOrder}
                    isAuditing={isAuditing}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'collaboration' ? (
              leftSidebarOpen ? (
                <div className="w-[260px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <CollaborationPanel
                    session={collabSession}
                    currentCollaboratorId={currentCollabId}
                    onCreateSession={handleCreateCollabSession}
                    onLeaveSession={handleLeaveCollabSession}
                    onGenerateInvite={handleGenerateInvite}
                    onChangeRole={handleChangeCollabRole}
                    onKickCollaborator={handleKickCollaborator}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'comments' ? (
              leftSidebarOpen ? (
                <div className="w-[280px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <CommentThreadPanel
                    threads={commentThreads}
                    currentPage={currentPage}
                    currentUserId="current-user"
                    currentUserName="Me"
                    onAddThread={handleAddCommentThread}
                    onReply={handleReplyToThread}
                    onEditComment={handleEditComment}
                    onDeleteComment={handleDeleteThreadComment}
                    onResolve={handleResolveThread}
                    onReopen={handleReopenThread}
                    activities={activityLog}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : leftSidebarTab === 'ai-advanced' ? (
              leftSidebarOpen ? (
                <div className="w-[280px] shrink-0 border-r border-dash-border bg-dash-surface overflow-y-auto">
                  <AiAdvancedPanel
                    piiDetections={piiDetections}
                    onScanPii={handleScanPii}
                    onAcceptPii={handleAcceptPii}
                    onRejectPii={handleRejectPii}
                    onAcceptAllPii={handleAcceptAllPiiDetections}
                    nlCommands={nlCommands}
                    onExecuteNlCommand={handleExecuteNlCommand}
                    autofillSuggestions={autofillSuggestions}
                    onAcceptSuggestion={handleAcceptAutofill}
                    onRejectSuggestion={handleRejectAutofill}
                    generatedBookmarks={generatedBookmarks}
                    onApplyBookmarks={handleApplyGeneratedBookmarks}
                    smartCropResults={smartCropResults}
                    onApplyCrop={handleApplySmartCrop}
                    currentPage={currentPage}
                    totalPages={pdf.totalPages}
                    isProcessing={isAiProcessing}
                  />
                </div>
              ) : (
                <ThumbnailSidebar
                  isOpen={false}
                  onToggle={() => setLeftSidebarOpen(true)}
                  totalPages={pdf.totalPages}
                  pageMetadata={pdf.pageMetadata}
                  renderer={pdf.renderer}
                  currentPage={currentPage}
                  onPageClick={setCurrentPage}
                />
              )
            ) : null}
          </div>
        )}

        {/* Center — Canvas or Drop Zone / Loading */}
        {!pdf.isLoaded && !pdf.isLoading && <DropZone onFile={pdf.loadFile} />}

        {pdf.isLoading && (
          <LoadingOverlay
            progress={pdf.progress}
            fileName={pdf.fileName || 'document.pdf'}
          />
        )}

        {pdf.isLoaded && pdf.renderer && (
          <div className="flex flex-1 flex-col overflow-hidden relative">
            {/* Find & Replace Bar (floating) */}
            {findReplace.state.isOpen && (
              <FindReplaceBar
                isOpen={findReplace.state.isOpen}
                query={findReplace.state.query}
                replacement={findReplace.state.replacement}
                caseSensitive={findReplace.state.caseSensitive}
                useRegex={findReplace.state.useRegex}
                matchCount={findReplace.matchCount}
                activeMatchIndex={findReplace.state.activeMatchIndex}
                onClose={findReplace.close}
                onQueryChange={findReplace.setQuery}
                onReplacementChange={findReplace.setReplacement}
                onToggleCaseSensitive={() =>
                  findReplace.setCaseSensitive(!findReplace.state.caseSensitive)
                }
                onToggleRegex={() =>
                  findReplace.setUseRegex(!findReplace.state.useRegex)
                }
                onNext={findReplace.nextMatch}
                onPrev={findReplace.prevMatch}
                onReplaceOne={findReplace.replaceOne}
                onReplaceAll={findReplace.replaceAll}
              />
            )}

            {/* Align & Distribute Bar (when multiple selected) */}
            {selectedAnnotationIds.length > 1 && (
              <AlignDistributeBar
                selectionCount={selectedAnnotationIds.length}
                onAlign={handleAlign}
                onDistribute={handleDistribute}
                onGroup={() => {
                  /* TODO: group implementation */
                }}
                onUngroup={() => {
                  /* TODO: ungroup implementation */
                }}
                onCopy={handleCopy}
                onPaste={handlePaste}
                hasClipboard={clipboard.length > 0}
              />
            )}

            {/* Page Management Bar */}
            <PageManagementBar
              currentPage={currentPage}
              totalPages={pdf.totalPages}
              isProcessing={pageManager.isProcessing}
              isFullScreen={isFullScreen}
              onInsertBlank={pageManager.handleInsertBlank}
              onDeletePage={pageManager.handleDelete}
              onDuplicatePage={pageManager.handleDuplicate}
              onRotatePage={pageManager.handleRotate}
              onExtractPages={pageManager.handleExtract}
              onToggleFullScreen={handleToggleFullScreen}
            />
            <CanvasViewport
              totalPages={pdf.totalPages}
              pageMetadata={pdf.pageMetadata}
              renderer={pdf.renderer}
              annotations={annotCtrl.annotations}
              zoom={zoomCtrl.zoom}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              activeTool={activeTool}
              onAnnotationAdded={annotCtrl.addAnnotation}
              onAnnotationModified={(id, updates) => {
                const result = annotCtrl.findAnnotation(id);
                if (result)
                  annotCtrl.updateAnnotation(result.page, id, updates);
              }}
              onAnnotationRemoved={handleAnnotationRemoved}
              onSelectionChanged={(ids) => {
                setSelectedAnnotationIds(ids);
                if (ids.length > 0) handleAnnotationSelect(ids[0]);
                else handleAnnotationSelect(null);
              }}
              viewMode="continuous"
            />
          </div>
        )}

        {/* Right — Properties Panel */}
        {pdf.isLoaded && rightPanelOpen && (
          <PropertiesPanel
            annotation={selectedAnnotation}
            onUpdate={handleAnnotationUpdate}
            onDelete={handleAnnotationDelete}
            onDuplicate={handleAnnotationDuplicate}
            onClose={() => {
              setRightPanelOpen(false);
              setSelectedAnnotation(null);
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      {pdf.isLoaded && (
        <StatusBar
          currentPage={currentPage}
          totalPages={pdf.totalPages}
          pageWidth={currentPageMeta?.width ?? 0}
          pageHeight={currentPageMeta?.height ?? 0}
          fileName={pdf.fileName}
          fileSize={pdf.fileSize}
          zoomLabel={zoomCtrl.zoomLabel}
          isDirty={isDirty}
          lastSaved={lastSaved}
        />
      )}

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onConfirm={handleSignatureConfirm}
      />

      {/* Stamp Dialog */}
      <StampDialog
        open={stampDialogOpen}
        onClose={() => setStampDialogOpen(false)}
        onConfirm={handleStampCreate}
      />

      {/* Header & Footer Dialog */}
      <HeaderFooterDialog
        open={headerFooterDialogOpen}
        onClose={() => setHeaderFooterDialogOpen(false)}
        onApply={(configs, pageNumberConfig) => {
          // Store configs for export-time use
          console.info('Header/Footer configs:', configs, pageNumberConfig);
          setHeaderFooterDialogOpen(false);
        }}
      />

      {/* Phase 4: Security Dialog */}
      <SecurityDialog
        open={securityDialogOpen}
        onClose={() => setSecurityDialogOpen(false)}
        onApply={handleSecurityApply}
        initialConfig={securityConfig ?? undefined}
      />

      {/* Phase 4: Metadata Editor */}
      <MetadataEditor
        open={metadataEditorOpen}
        onClose={() => setMetadataEditorOpen(false)}
        onApply={handleMetadataApply}
        initialMetadata={documentMetadata}
      />

      {/* Phase 4: Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleAdvancedExport}
        currentSize={pdf.fileSize}
        metadata={documentMetadata}
        isExporting={isExporting}
      />

      {/* Phase 5: Certificate Manager */}
      <CertificateManager
        open={certificateManagerOpen}
        onClose={() => setCertificateManagerOpen(false)}
        store={certificateStore}
        onImportCertificate={handleImportCertificate}
        onRemoveCertificate={handleRemoveCertificate}
        onSelectCertificate={handleSelectCertificate}
        onPlaceSignature={handlePlaceSignature}
        signatures={digitalSignatures}
        verifications={signatureVerifications}
        currentPage={currentPage}
      />

      {/* Error Toast */}
      {pdf.error && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-600">
          {pdf.error}
        </div>
      )}

      {/* Page Manager Error Toast */}
      {pageManager.error && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {pageManager.error}
        </div>
      )}

      {/* Auto-save Draft Restore Banner */}
      {autoSave.hasPendingDraft && (
        <div className="absolute top-[90px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-[var(--im-primary)]/30 bg-[var(--im-primary)]/5 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 text-[var(--im-primary)] shrink-0" />
          <span className="text-xs text-dash-text">
            Unsaved edits found for this document.
          </span>
          <button
            onClick={async () => {
              const draft = autoSave.restoreDraft();
              if (draft) {
                annotCtrl.setAnnotations(draft.annotations);
                setCurrentPage(draft.currentPage);
                zoomCtrl.setZoom(draft.zoom);
                setIsDirty(true);
              }
            }}
            className="text-xs font-semibold text-[var(--im-primary)] hover:underline"
          >
            Restore
          </button>
          <button
            onClick={autoSave.dismissDraft}
            className="text-xs text-dash-text-muted hover:text-dash-text"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
