// SPDX-License-Identifier: Apache-2.0
import { MongoClient } from 'mongodb';

const options = {};

declare global {
 // eslint-disable-next-line no-var
 var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function getMongoDbUri() {
 const mongodbUri = process.env.MONGODB_URI;

 if (!mongodbUri) {
  throw new Error('Missing MONGODB_URI in environment variables');
 }

 return mongodbUri;
}

function getClientPromise() {
 if (clientPromise) {
  return clientPromise;
 }

 if (process.env.NODE_ENV === 'development') {
  if (!globalThis._mongoClientPromise) {
   const client = new MongoClient(getMongoDbUri(), options);
   globalThis._mongoClientPromise = client.connect();
  }

  clientPromise = globalThis._mongoClientPromise;
  return clientPromise;
 }

 const client = new MongoClient(getMongoDbUri(), options);
 clientPromise = client.connect();
 return clientPromise;
}

const lazyClientPromise = {
 then(onfulfilled, onrejected) {
  return getClientPromise().then(onfulfilled, onrejected);
 },
 catch(onrejected) {
  return getClientPromise().catch(onrejected);
 },
 finally(onfinally) {
  return getClientPromise().finally(onfinally);
 },
 [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default lazyClientPromise;
