// SPDX-License-Identifier: Apache-2.0
import mongoose from 'mongoose';

type MongooseCache = {
 conn: typeof mongoose | null;
 promise: Promise<typeof mongoose> | null;
};

declare global {
 // eslint-disable-next-line no-var
 var mongooseCache: MongooseCache | undefined;
}

const cached = globalThis.mongooseCache ?? { conn: null, promise: null };

globalThis.mongooseCache = cached;

function getMongoDbUri() {
 const mongodbUri = process.env.MONGODB_URI ?? '';

 if (!mongodbUri) {
	throw new Error('Missing MONGODB_URI in environment variables');
 }

 return mongodbUri;
}

export async function connectToDatabase() {
 if (cached.conn) {
 return cached.conn;
 }

 if (!cached.promise) {
	cached.promise = mongoose.connect(getMongoDbUri(), {
 dbName: process.env.MONGODB_DB || undefined,
 });
 }

 cached.conn = await cached.promise;
 return cached.conn;
}
