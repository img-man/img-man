// SPDX-License-Identifier: Apache-2.0
import ToolsClient from '../tools/tools-client';

export const metadata = { title: 'PDF Suite — img-man' };

export default function PdfSuitePage() {
  return (
    <ToolsClient
      initialTab="pdf"
      title="PDF Suite"
      description="iLovePDF-style tools for merge, split, organize, edit, OCR, sign, protect, and export."
      hideTabs
    />
  );
}
