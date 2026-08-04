// SPDX-License-Identifier: Apache-2.0

export interface SyntheticMigrationBatchResult {
  readonly nextIndex: number;
  readonly lastKey?: string;
  readonly batchesProcessed: number;
  readonly objectsProcessed: number;
  readonly completed: boolean;
}

export interface SyntheticResumeSummary {
  readonly totalObjects: number;
  readonly batchSize: number;
  readonly killAfterBatches: number;
  readonly firstPass: SyntheticMigrationBatchResult;
  readonly resumedFromIndex: number;
  readonly secondPass: SyntheticMigrationBatchResult;
  readonly finalProcessedObjects: number;
  readonly completed: boolean;
}

export function buildSyntheticMigrationKey(index: number): string {
  const tenant = index % 50;
  const year = 2020 + (index % 6);
  const month = String((index % 12) + 1).padStart(2, '0');
  const day = String((index % 28) + 1).padStart(2, '0');
  const shard = String(Math.floor(index / 1000)).padStart(6, '0');

  return `tenant-${tenant}/archive/${year}/${month}/${day}/asset-${shard}-${String(index).padStart(9, '0')}.jpg`;
}

export function runSyntheticMigrationBatches({
  totalObjects,
  batchSize,
  startIndex = 0,
  maxBatches = Number.POSITIVE_INFINITY,
}: {
  totalObjects: number;
  batchSize: number;
  startIndex?: number;
  maxBatches?: number;
}): SyntheticMigrationBatchResult {
  if (!Number.isInteger(totalObjects) || totalObjects < 0) {
    throw new Error(`totalObjects must be a non-negative integer, got ${totalObjects}`);
  }

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`batchSize must be a positive integer, got ${batchSize}`);
  }

  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex > totalObjects) {
    throw new Error(`startIndex must be between 0 and totalObjects, got ${startIndex}`);
  }

  if (Number.isNaN(maxBatches) || maxBatches <= 0) {
    throw new Error(`maxBatches must be > 0, got ${maxBatches}`);
  }

  let pointer = startIndex;
  let batchesProcessed = 0;
  let lastKey: string | undefined;

  while (pointer < totalObjects && batchesProcessed < maxBatches) {
    const upperBound = Math.min(totalObjects, pointer + batchSize);

    for (let index = pointer; index < upperBound; index += 1) {
      lastKey = buildSyntheticMigrationKey(index);
    }

    pointer = upperBound;
    batchesProcessed += 1;
  }

  return {
    nextIndex: pointer,
    lastKey,
    batchesProcessed,
    objectsProcessed: pointer - startIndex,
    completed: pointer >= totalObjects,
  };
}

export function runResumeAfterKillSimulation({
  totalObjects,
  batchSize,
  killAfterBatches,
}: {
  totalObjects: number;
  batchSize: number;
  killAfterBatches: number;
}): SyntheticResumeSummary {
  if (!Number.isInteger(killAfterBatches) || killAfterBatches <= 0) {
    throw new Error(`killAfterBatches must be a positive integer, got ${killAfterBatches}`);
  }

  const firstPass = runSyntheticMigrationBatches({
    totalObjects,
    batchSize,
    startIndex: 0,
    maxBatches: killAfterBatches,
  });

  const secondPass = runSyntheticMigrationBatches({
    totalObjects,
    batchSize,
    startIndex: firstPass.nextIndex,
  });

  const finalProcessedObjects = firstPass.objectsProcessed + secondPass.objectsProcessed;
  const completed = firstPass.nextIndex > 0 && secondPass.completed && finalProcessedObjects === totalObjects;

  return {
    totalObjects,
    batchSize,
    killAfterBatches,
    firstPass,
    resumedFromIndex: firstPass.nextIndex,
    secondPass,
    finalProcessedObjects,
    completed,
  };
}