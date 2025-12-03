import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
import { DEFAULT_DB_NAME } from "./constants";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set. Please define it in your .env file.");
}

const client = new MongoClient(uri, {
  retryWrites: true,
  writeConcern: { w: "majority" },
});

const statsClient = new MongoClient(uri, {
  retryWrites: true,
});

let clientPromise: Promise<MongoClient> | null = null;
let statsClientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(dbName: string = DEFAULT_DB_NAME): Promise<Db> {
  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

export async function getStatsDb(dbName: string = DEFAULT_DB_NAME): Promise<Db> {
  if (!statsClientPromise) {
    statsClientPromise = statsClient.connect();
  }
  const mongoClient = await statsClientPromise;
  return mongoClient.db(dbName);
}

export async function closeMongoClient() {
  if (clientPromise) {
    const connectedClient = await clientPromise;
    await connectedClient.close();
    clientPromise = null;
  }
  if (statsClientPromise) {
    const connectedClient = await statsClientPromise;
    await connectedClient.close();
    statsClientPromise = null;
  }
}
