import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import collectionsRouter from "./routes/collections";
import dashboardRouter from "./routes/dashboard";
import adminRouter from "./routes/admin";
import { initRealtime } from "./realtime";
import { API_BASE_PATH } from "./constants";
import { getMongoClient } from "./mongoClient";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(`${API_BASE_PATH}/collections`, collectionsRouter);
app.use(`${API_BASE_PATH}/dashboard`, dashboardRouter);
app.use(`${API_BASE_PATH}/admin`, adminRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Internal server error" });
});

const port = Number(process.env.SERVER_PORT) || 4000;

async function bootstrap() {
  await getMongoClient();
  const server = createServer(app);
  await initRealtime(server);

  server.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
