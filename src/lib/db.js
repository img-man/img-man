import { MongoClient } from 'mongodb';

const globalForMongo = globalThis;
const mongoState = globalForMongo.__imgManMongoState ?? {
  client: null,
  promise: null,
};

globalForMongo.__imgManMongoState = mongoState;

function getMongoUri() {
  const uri = String(process.env.MONGODB_URI ?? '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is not set.');
  }
  return uri;
}

export function getMongoDbName() {
  return String(process.env.MONGODB_DB ?? 'imageman').trim() || 'imageman';
}

export async function connectToDatabase() {
  if (mongoState.client) {
    return mongoState.client;
  }

  if (!mongoState.promise) {
    const client = new MongoClient(getMongoUri(), {
      serverSelectionTimeoutMS: 5000,
    });

    mongoState.promise = client.connect().then(async (connectedClient) => {
      await connectedClient.db(getMongoDbName()).command({ ping: 1 });
      mongoState.client = connectedClient;
      return connectedClient;
    });
  }

  try {
    return await mongoState.promise;
  } catch (error) {
    mongoState.promise = null;
    throw error;
  }
}
