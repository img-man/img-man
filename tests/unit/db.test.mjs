import assert from 'node:assert/strict';
import test from 'node:test';

import { connectToDatabase, getMongoDbName } from '../../src/lib/db.js';

test('getMongoDbName falls back to imageman by default', () => {
  const previous = process.env.MONGODB_DB;

  try {
    delete process.env.MONGODB_DB;
    assert.equal(getMongoDbName(), 'imageman');
  } finally {
    if (previous === undefined) {
      delete process.env.MONGODB_DB;
    } else {
      process.env.MONGODB_DB = previous;
    }
  }
});

test('getMongoDbName trims configured values', () => {
  const previous = process.env.MONGODB_DB;

  try {
    process.env.MONGODB_DB = '  custom-db  ';
    assert.equal(getMongoDbName(), 'custom-db');
  } finally {
    if (previous === undefined) {
      delete process.env.MONGODB_DB;
    } else {
      process.env.MONGODB_DB = previous;
    }
  }
});

test('connectToDatabase fails fast when MONGODB_URI is missing', async () => {
  const previous = process.env.MONGODB_URI;

  try {
    delete process.env.MONGODB_URI;
    await assert.rejects(connectToDatabase(), /MONGODB_URI is not set/i);
  } finally {
    if (previous === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previous;
    }
  }
});
