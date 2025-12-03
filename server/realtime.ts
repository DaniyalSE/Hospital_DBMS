import { Server as HttpServer } from "http";
import { WebSocketServer } from "ws";
import type { ChangeStream, ChangeStreamDocument, Document } from "mongodb";
import { REALTIME_PATH, HOSPITAL_COLLECTIONS } from "./constants";
import { getDb } from "./mongoClient";
import { RealtimePayload } from "./types/realtime";

export async function initRealtime(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: REALTIME_PATH });

  const broadcast = (payload: RealtimePayload) => {
    const data = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    });
  };

  const db = await getDb();
  const changeStreams: ChangeStream[] = HOSPITAL_COLLECTIONS.map((collectionName) => {
    try {
      const collection = db.collection(collectionName);
      const stream = collection.watch([], { fullDocument: "updateLookup" });
      stream.on("change", (event: ChangeStreamDocument<Document>) => {
        const payload: RealtimePayload = {
          collection: collectionName,
          operationType: event.operationType,
          documentKey: "documentKey" in event ? event.documentKey : undefined,
          fullDocument: "fullDocument" in event ? event.fullDocument : undefined,
          updateDescription: "updateDescription" in event ? event.updateDescription : undefined,
          timestamp: new Date().toISOString(),
        };
        broadcast(payload);
      });
      stream.on("error", (error) => {
        console.error(`Change stream error on ${collectionName}`, error);
      });
      return stream;
    } catch (error) {
      console.warn(`Unable to open change stream for ${collectionName}`, error);
      return null;
    }
  }).filter((stream): stream is ChangeStream => Boolean(stream));

  const closeStreams = () => {
    changeStreams.forEach((stream) => stream?.close().catch(() => undefined));
    wss.close();
  };

  process.on("SIGTERM", closeStreams);
  process.on("SIGINT", closeStreams);
}
