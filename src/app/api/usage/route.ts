// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Organization, BandwidthLog } from '@/models';
import mongoose from 'mongoose';

/**
 * GET /api/usage
 * Returns the current org's resource usage for this self-hosted deployment.
 * There are no plan limits — usage is reported as-is so operators can watch
 * their own bucket and bandwidth consumption.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const org = await Organization.findById(user.orgId).select('usage name').lean();
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Current month bandwidth from BandwidthLog
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const orgId = new mongoose.Types.ObjectId(String(org._id));

  const [bandwidthAgg] = await BandwidthLog.aggregate([
    { $match: { orgId, date: { $gte: monthStart } } },
    {
      $group: {
        _id: null,
        totalBytes: { $sum: '$totalBytes' },
        uploadBytes: { $sum: '$uploadBytes' },
        downloadBytes: { $sum: '$downloadBytes' },
        transformBytes: { $sum: '$transformBytes' },
        cdnBytes: { $sum: '$cdnBytes' },
      },
    },
  ]);

  return NextResponse.json({
    deployment: 'self-hosted',
    storage: {
      usedBytes: org.usage?.storageBytes ?? 0,
    },
    bandwidth: {
      usedBytes: bandwidthAgg?.totalBytes ?? 0,
      cumulativeBytes: org.usage?.bandwidth ?? 0,
      breakdown: {
        upload: bandwidthAgg?.uploadBytes ?? 0,
        download: bandwidthAgg?.downloadBytes ?? 0,
        transform: bandwidthAgg?.transformBytes ?? 0,
        cdn: bandwidthAgg?.cdnBytes ?? 0,
      },
    },
    aiJobs: {
      total: org.usage?.aiJobs ?? 0,
    },
  });
}
