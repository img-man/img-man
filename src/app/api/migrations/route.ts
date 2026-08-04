// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import {
  createEmptyMigrationCounts,
  estimateMigrationCost,
  getMigrationProviderRuntime,
  MIGRATION_MUTATION_MODES,
  MIGRATION_PROVIDER_RUNTIMES,
  normalizeMigrationPrefix,
  projectMigrationFolders,
  serializeMigrationJobForApi,
  transitionMigrationStatus,
  type MigrationMutationMode,
} from '@/lib/migrations';
import { MigrationJob } from '@/models';
import { STORAGE_PROVIDERS, type StorageProviderId } from '@/types/providers';

function sanitizeOptInPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) {
    return [];
  }

  return Array.from(
    new Set(
      paths
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeMigrationPrefix(value))
        .filter(Boolean),
    ),
  );
}

/**
 * GET /api/migrations
 * List migration jobs for the current organization.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission('manage_settings');
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { orgId: ctx.orgId };
    if (status) filter.status = status;
    if (provider) filter.provider = provider;

    const [jobs, total] = await Promise.all([
      MigrationJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      MigrationJob.countDocuments(filter),
    ]);

    return NextResponse.json({
      jobs: jobs.map((job) => serializeMigrationJobForApi(job)),
      providers: MIGRATION_PROVIDER_RUNTIMES,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}

/**
 * POST /api/migrations
 * Create a migration draft or queue a dry run.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission('manage_settings');
    await connectToDatabase();

    const body = await req.json();
    const {
      provider,
      bucket,
      prefix,
      mode = 'read-only',
      mutationOptInPaths,
      estimatedObjects = 0,
      averageMetadataReadsPerObject = 0,
      sampleKeys = [],
      queueDryRun = false,
    } = body as {
      provider?: string;
      bucket?: string;
      prefix?: string;
      mode?: MigrationMutationMode;
      mutationOptInPaths?: unknown;
      estimatedObjects?: number;
      averageMetadataReadsPerObject?: number;
      sampleKeys?: string[];
      queueDryRun?: boolean;
    };

    if (!provider || !STORAGE_PROVIDERS.includes(provider as StorageProviderId)) {
      return NextResponse.json(
        { error: 'provider must be "gcp", "aws", or "azure"' },
        { status: 400 },
      );
    }

    if (!bucket?.trim()) {
      return NextResponse.json({ error: 'bucket is required' }, { status: 400 });
    }

    if (!MIGRATION_MUTATION_MODES.includes(mode)) {
      return NextResponse.json(
        { error: 'mode must be "read-only" or "folder-opt-in"' },
        { status: 400 },
      );
    }

    const providerId = provider as StorageProviderId;
    const providerRuntime = getMigrationProviderRuntime(providerId);

    if (queueDryRun && providerRuntime.dryRunStatus !== 'available') {
      return NextResponse.json(
        { error: `${providerRuntime.label} dry runs are still planned, not available.` },
        { status: 400 },
      );
    }

    const normalizedPrefix = normalizeMigrationPrefix(prefix);
    const sanitizedOptInPaths = sanitizeOptInPaths(mutationOptInPaths);
    const projectedFolders = projectMigrationFolders(sampleKeys, normalizedPrefix);
    const costEstimate = estimateMigrationCost({
      estimatedObjects,
      averageMetadataReadsPerObject,
    });
    const nextStatus = queueDryRun
      ? transitionMigrationStatus('draft', 'queue-dry-run') ?? 'draft'
      : 'draft';

    const job = await MigrationJob.create({
      orgId: ctx.orgId,
      createdById: ctx.userId,
      provider: providerId,
      bucket: bucket.trim(),
      prefix: normalizedPrefix,
      status: nextStatus,
      mode,
      mutationOptInPaths: sanitizedOptInPaths,
      projectedFolders,
      cursor: { prefix: normalizedPrefix },
      counts: createEmptyMigrationCounts({ foldersProjected: projectedFolders.length }),
      costEstimate,
      errorEntries: [],
    });

    return NextResponse.json(
      {
        job: serializeMigrationJobForApi(job),
        provider: providerRuntime,
        queuedDryRun: queueDryRun,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}