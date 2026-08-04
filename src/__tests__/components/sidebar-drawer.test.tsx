// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock role context so AssetDrawer renders with editor-level permissions
vi.mock('@/components/dashboard/role-context', () => ({
 useRole: () => ({
 role: 'editor',
 orgSlug: 'test-org',
 loading: false,
 can: () => true,
 canAccessSection: () => true,
 sectionAccess: {},
 }),
}));

vi.mock('@/components/dashboard/image-viewer', () => ({
	ImageViewer: () => <div>Image Viewer</div>,
}));

vi.mock('@/components/dashboard/share-dialog', () => ({
	ShareDialog: () => <div>Share Dialog</div>,
}));

vi.mock('@/components/dashboard/transform-preview', () => ({
	TransformPreview: () => <div>Transform Preview</div>,
}));

vi.mock('@/components/dashboard/pdf-viewer', () => ({
	PdfViewer: ({ name }: { name: string }) => <div>{name} PDF Viewer</div>,
}));

vi.mock('@/components/dashboard/video-player', () => ({
	VideoPlayer: ({ name }: { name: string }) => <div>{name} Video Player</div>,
}));

vi.mock('@/components/dashboard/text-viewer', () => ({
	TextViewer: ({ name }: { name: string }) => <div>{name} Text Viewer</div>,
}));

vi.mock('@/components/dashboard/csv-viewer', () => ({
	CsvViewer: ({ name }: { name: string }) => <div>{name} CSV Viewer</div>,
}));

vi.mock('@/components/dashboard/audio-player', () => ({
	AudioPlayer: ({ name }: { name: string }) => <div>{name} Audio Player</div>,
}));

vi.mock('@/components/dashboard/spreadsheet-viewer', () => ({
	SpreadsheetViewer: ({ name }: { name: string }) => (
		<div>{name} Spreadsheet Viewer</div>
	),
}));

vi.mock('@/components/dashboard/docx-viewer', () => ({
	DocxViewer: ({ name }: { name: string }) => <div>{name} DOCX Viewer</div>,
}));

vi.mock('@/components/dashboard/presentation-viewer', () => ({
	PresentationViewer: ({ name }: { name: string }) => (
		<div>{name} Presentation Viewer</div>
	),
}));

vi.mock('@/components/dashboard/document-text-viewer', () => ({
	DocumentTextViewer: ({ name }: { name: string }) => (
		<div>{name} Document Viewer</div>
	),
}));

vi.mock('@/components/dashboard/office-fallback-viewer', () => ({
	OfficeFallbackViewer: ({ name }: { name: string }) => (
		<div>{name} Office Fallback</div>
	),
}));

vi.mock('@/components/dashboard/edit-history-panel', () => ({
	EditHistoryPanel: ({ assetId }: { assetId: string }) => (
		<div>Edit history for {assetId}</div>
	),
}));

describe('FolderSidebar', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 vi.mocked(global.fetch).mockReset();
 });

 it('renders "All Assets" button and folder list', async () => {
 const mockFolders = [
 { _id: 'f1', name: 'Photos', parentId: null },
 { _id: 'f2', name: 'Logos', parentId: null },
 ];

 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({ folders: mockFolders }),
 } as Response);

 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId={null} onSelect={vi.fn()} />);

 await waitFor(() => {
 expect(screen.getByText('All Assets')).toBeInTheDocument();
 expect(screen.getByText('Photos')).toBeInTheDocument();
 expect(screen.getByText('Logos')).toBeInTheDocument();
 });
 });

 it('highlights active folder', async () => {
 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({
 folders: [{ _id: 'f1', name: 'Photos', parentId: null }],
 }),
 } as Response);

 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId="f1" onSelect={vi.fn()} />);

 await waitFor(() => {
 expect(screen.getByText('Photos')).toBeInTheDocument();
 });

 // "All Assets" should NOT be highlighted when a folder is active
 const allAssetsBtn = screen.getByText('All Assets');
 expect(allAssetsBtn.closest('button')?.className).not.toContain(
 'font-semibold',
 );
 });

 it('calls onSelect(null) when "All Assets" clicked', async () => {
 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({ folders: [] }),
 } as Response);

 const onSelect = vi.fn();
 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId="f1" onSelect={onSelect} />);

 await waitFor(() => {
 expect(screen.getByText('All Assets')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByText('All Assets'));
 expect(onSelect).toHaveBeenCalledWith(null);
 });

 it('builds nested tree from flat folder list', async () => {
 const mockFolders = [
 { _id: 'f1', name: 'Photos', parentId: null },
 { _id: 'f2', name: 'Summer', parentId: 'f1' },
 { _id: 'f3', name: 'Logos', parentId: null },
 ];

 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({ folders: mockFolders }),
 } as Response);

 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId={null} onSelect={vi.fn()} />);

 await waitFor(() => {
 // Root folders should be visible
 expect(screen.getByText('Photos')).toBeInTheDocument();
 expect(screen.getByText('Logos')).toBeInTheDocument();
 });

 // Summer is a child of Photos. Initially NOT visible (collapsed)
 expect(screen.queryByText('Summer')).not.toBeInTheDocument();
 });

 it('shows create folder form when + button clicked', async () => {
 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({ folders: [] }),
 } as Response);

 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId={null} onSelect={vi.fn()} />);

 // Click the + button (it has title "New folder")
 const addBtn = screen.getByTitle('New folder');
 fireEvent.click(addBtn);

 await waitFor(() => {
 expect(screen.getByPlaceholderText('Folder name')).toBeInTheDocument();
 });
 });

 it('displays folder count', async () => {
 const mockFolders = [
 { _id: 'f1', name: 'A', parentId: null },
 { _id: 'f2', name: 'B', parentId: null },
 { _id: 'f3', name: 'C', parentId: 'f1' },
 ];

 vi.mocked(global.fetch).mockResolvedValue({
 ok: true,
 json: async () => ({ folders: mockFolders }),
 } as Response);

 const { FolderSidebar } =
 await import('@/components/dashboard/folder-sidebar');

 render(<FolderSidebar activeFolderId={null} onSelect={vi.fn()} />);

 await waitFor(() => {
 expect(screen.getByText('3 folders')).toBeInTheDocument();
 });
 });
});

describe('AssetDrawer', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 vi.mocked(global.fetch).mockReset();
 });

 const mockAsset = {
 _id: 'a1',
 name: 'sunset.jpg',
 mimeType: 'image/jpeg',
 sizeBytes: 1_500_000,
 width: 1920,
 height: 1080,
 url: 'https://example.com/sunset.jpg',
 tags: ['nature', 'sunset'],
 createdAt: '2025-06-15T00:00:00Z',
 };

 it('renders asset preview and metadata', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 expect(screen.getByText('sunset.jpg')).toBeInTheDocument();
 expect(screen.getByText('Inline preview')).toBeInTheDocument();
 expect(screen.getByText('image/jpeg')).toBeInTheDocument();
 expect(screen.getByText('1.4 MB')).toBeInTheDocument();
 expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
 expect(screen.getByAltText('sunset.jpg')).toBeInTheDocument();
 }, 15000);

 it('renders document insight summary for docx assets', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(
 <AssetDrawer
 asset={{
 ...mockAsset,
 name: 'brief.docx',
 mimeType:
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 pageCount: 12,
 }}
 onClose={vi.fn()}
 />,
 );

 expect(screen.getByText('Word document')).toBeInTheDocument();
 expect(screen.getAllByText('Inline preview').length).toBeGreaterThan(0);
 expect(screen.getByText('12 pages')).toBeInTheDocument();
 expect(screen.getByText('Pages')).toBeInTheDocument();
 });

 it('uses Slides label for presentation counts', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(
 <AssetDrawer
 asset={{
 ...mockAsset,
 name: 'deck.pptx',
 mimeType:
 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 pageCount: 18,
 }}
 onClose={vi.fn()}
 />,
 );

 expect(screen.getByText('Presentation deck')).toBeInTheDocument();
 expect(screen.getByText('18 slides')).toBeInTheDocument();
 expect(screen.getByText('Slides')).toBeInTheDocument();
 });

 it('shows guided download for legacy office files', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(
 <AssetDrawer
 asset={{
 ...mockAsset,
 name: 'legacy.doc',
 mimeType: 'application/msword',
 pageCount: 4,
 url: 'https://example.com/legacy.doc',
 }}
 onClose={vi.fn()}
 />,
 );

 expect(screen.getByText('Legacy Office file')).toBeInTheDocument();
 expect(screen.getAllByText('Guided download').length).toBeGreaterThan(0);
 });

 it('renders provenance, colors, and custom metadata when available', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(
 <AssetDrawer
 asset={{
 ...mockAsset,
 originalName: 'IMG_2048.CR2',
 fileCategory: 'document',
 variants: [
	 { key: 'thumb', storageKey: 'variants/thumb.webp' },
	 { key: 'web', storageKey: 'variants/web.webp' },
 ],
 customMetadata: {
	 approvalStatus: 'approved',
	 sourceSystem: 'migration-batch-7',
 },
 dominantColors: ['#112233', '#445566'],
 exif: {
	 camera: 'Canon EOS R5',
	 iso: 400,
	 aperture: 'f/2.8',
 },
 }}
 onClose={vi.fn()}
 />,
 );

 expect(screen.getByText('File insights')).toBeInTheDocument();
 expect(screen.getByText('Original filename')).toBeInTheDocument();
 expect(screen.getByText('IMG_2048.CR2')).toBeInTheDocument();
 expect(screen.getByText('2 saved')).toBeInTheDocument();
 expect(screen.getByText('Dominant colors')).toBeInTheDocument();
 expect(screen.getByText('#112233')).toBeInTheDocument();
 expect(screen.getByText('Capture details')).toBeInTheDocument();
 expect(screen.getByText('Canon EOS R5')).toBeInTheDocument();
 expect(screen.getByText('Custom metadata')).toBeInTheDocument();
 expect(screen.getByText('Approval Status')).toBeInTheDocument();
 expect(screen.getByText('migration-batch-7')).toBeInTheDocument();
 });

	it('renders variant lineage and edit history for image assets', async () => {
	const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

	render(
	<AssetDrawer
	asset={{
	...mockAsset,
	variants: [
		{
			key: 'bgRemoved',
			storageKey: 'variants/bg-removed.png',
			format: 'png',
			width: 1920,
			height: 1080,
			sizeBytes: 820000,
		},
	],
	}}
	onClose={vi.fn()}
	/>,
	);

	expect(screen.getAllByText('Variants').length).toBeGreaterThan(0);
	expect(screen.getByText('Bg Removed')).toBeInTheDocument();
	expect(screen.getAllByText(/PNG/i).length).toBeGreaterThan(0);
	expect(screen.getByText('Edit lineage')).toBeInTheDocument();
	expect(screen.getByText('Edit history for a1')).toBeInTheDocument();
	});

 it('renders tags as chips', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 expect(screen.getByText('nature')).toBeInTheDocument();
 expect(screen.getByText('sunset')).toBeInTheDocument();
 });

 it('shows face detection inside the collapsible AI actions section', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 expect(screen.getByText('AI Actions')).toBeInTheDocument();
 expect(screen.queryByText('Face Detection')).not.toBeInTheDocument();

 fireEvent.click(screen.getByText('AI Actions'));

 expect(screen.getByText('Face Detection')).toBeInTheDocument();
 expect(screen.getByText('Detect Faces')).toBeInTheDocument();
 });

 it('calls onClose when backdrop clicked', async () => {
 const onClose = vi.fn();
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={onClose} />);

 // Click the backdrop (first fixed div)
 const backdrop = document.querySelector('.fixed.inset-0');
 if (backdrop) fireEvent.click(backdrop);
 expect(onClose).toHaveBeenCalled();
 });

 it('shows delete confirmation on delete click', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 // Click "Delete" button
 fireEvent.click(screen.getByText('Delete'));

 // Should now show "Confirm" and "Cancel" buttons
 await waitFor(() => {
 expect(screen.getByText('Confirm')).toBeInTheDocument();
 expect(screen.getByText('Cancel')).toBeInTheDocument();
 });
 });

 it('clicking Cancel hides delete confirmation', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 fireEvent.click(screen.getByText('Delete'));

 await waitFor(() => {
 expect(screen.getByText('Confirm')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByText('Cancel'));

 await waitFor(() => {
 expect(screen.getByText('Delete')).toBeInTheDocument();
 expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
 });
 });

 it('has Download button with size dropdown', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 const downloadBtn = screen.getByText('Download');
 expect(downloadBtn).toBeInTheDocument();
 // New download is a button (not a link) with dropdown sizes
 expect(downloadBtn.closest('button')).toBeInTheDocument();
 });

 it('shows Auto-tag button', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(<AssetDrawer asset={mockAsset} onClose={vi.fn()} />);

 expect(screen.getByText('Auto-tag')).toBeInTheDocument();
 });

	it('shows the standardized unsupported preview message for non-previewable files', async () => {
 const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

 render(
 <AssetDrawer
 asset={{
 ...mockAsset,
	name: 'archive.zip',
	mimeType: 'application/zip',
	url: 'https://example.com/archive.zip',
 }}
 onClose={vi.fn()}
 />,
 );

 expect(
 screen.getByText('Preview not supported yet — file still stored safely'),
 ).toBeInTheDocument();
 expect(screen.getByText('Open File')).toBeInTheDocument();
	});

	it('toggles asset link privacy and persists the change', async () => {
	const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: async () => ({ enabled: false }),
	} as Response);

	render(
		<AssetDrawer
			asset={{
				...mockAsset,
				publicUrl: 'http://localhost:3000/i/a1',
				isPublic: true,
			}}
			onClose={vi.fn()}
		/>,
	);

	const toggle = screen.getByRole('switch', { name: 'Private asset link' });
	expect(toggle).toHaveAttribute('aria-checked', 'false');
	expect(screen.getByText('Public')).toBeInTheDocument();

	fireEvent.click(toggle);

	await waitFor(() => {
		expect(toggle).toHaveAttribute('aria-checked', 'true');
		expect(screen.getByText('Private')).toBeInTheDocument();
	});

	expect(global.fetch).toHaveBeenCalledWith(
		'/api/assets/a1',
		expect.objectContaining({
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isPublic: false }),
		}),
	);
	});

	it('shows a degraded asset warning and permanently deletes broken assets', async () => {
	const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
	const onAssetDeleted = vi.fn();
	const onClose = vi.fn();
	const { AssetDrawer } = await import('@/components/dashboard/asset-drawer');

	vi.mocked(global.fetch).mockResolvedValue({
		ok: true,
		json: async () => ({ success: true, deletedPermanently: true }),
	} as Response);

	render(
		<AssetDrawer
			asset={{
				...mockAsset,
				integrityStatus: 'thumbnail-fallback',
				originalExists: false,
				thumbnailExists: true,
			}}
			onClose={onClose}
			onAssetDeleted={onAssetDeleted}
		/>,
	);

	expect(screen.getByText('Broken Cloud Asset')).toBeInTheDocument();
	expect(screen.getByText(/thumbnail fallback/i)).toBeInTheDocument();

	fireEvent.click(screen.getByText('Delete Permanently'));

	await waitFor(() => {
		expect(confirmSpy).toHaveBeenCalled();
		expect(global.fetch).toHaveBeenCalledWith(
			'/api/assets/a1?permanent=1',
			expect.objectContaining({ method: 'DELETE' }),
		);
		expect(onAssetDeleted).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});
	});
});
