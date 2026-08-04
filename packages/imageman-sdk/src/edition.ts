// SPDX-License-Identifier: Apache-2.0

export const IMGMAN_EDITIONS = ['community', 'cloud', 'white-label'] as const;

export type ImgManEdition = (typeof IMGMAN_EDITIONS)[number];

export interface NavigationItem {
  id: string;
  title: string;
  href: string;
}

export interface NavigationGroup {
  id: string;
  title: string;
  items?: NavigationItem[];
}

export interface DashboardExtension {
  id: string;
  title: string;
  href: string;
  groupId?: string;
}

export interface DesignStudioPanel {
  id: string;
  title: string;
  order?: number;
}

export interface StorageProviderFactory {
  id: string;
  label: string;
}

export interface AiProviderFactory {
  id: string;
  label: string;
}

export interface ImgManToolFactory {
  name: string;
  description: string;
}

export interface BrandingConfig {
  productName?: string;
  logoUrl?: string;
  accentColor?: string;
}

export interface ImgManEditionManifest {
  edition: ImgManEdition;
  navigationGroups?: NavigationGroup[];
  dashboardExtensions?: DashboardExtension[];
  designStudioPanels?: DesignStudioPanel[];
  storageProviders?: StorageProviderFactory[];
  aiProviders?: AiProviderFactory[];
  agentTools?: ImgManToolFactory[];
  branding?: BrandingConfig;
}