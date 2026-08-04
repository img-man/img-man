// SPDX-License-Identifier: Apache-2.0
/**
 * Design Images Folder Helper
 *
 * Ensures a "Design Images" folder exists for the organization.
 * All AI-generated images from the Design Studio are stored in this folder
 * so they don't get lost in the root/unsorted area.
 *
 * Uses a find-or-create pattern with upsert to avoid race conditions.
 */

import { Folder } from '@/models';
import { connectToDatabase } from './db';

const DESIGN_IMAGES_FOLDER_NAME = 'Design Images';
const DESIGN_IMAGES_FOLDER_PATH = '/Design Images';

/**
 * Find or create the "Design Images" folder for an org.
 * Returns the folder's _id as a string.
 *
 * Thread-safe: uses findOneAndUpdate with upsert to handle
 * concurrent requests creating the same folder.
 */
export async function ensureDesignImagesFolder(
  orgId: string,
  createdById: string,
): Promise<string> {
  await connectToDatabase();

  const folder = await Folder.findOneAndUpdate(
    {
      orgId,
      name: DESIGN_IMAGES_FOLDER_NAME,
      parentId: null, // root-level folder
    },
    {
      $setOnInsert: {
        orgId,
        name: DESIGN_IMAGES_FOLDER_NAME,
        path: DESIGN_IMAGES_FOLDER_PATH,
        parentId: null,
        createdById,
        accessMode: 'inherit',
      },
    },
    {
      upsert: true,
      new: true,
      lean: true,
    },
  );

  return String(folder._id);
}
