import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";
import { loadEnv } from "./env.js";
import { logger } from "./logger.js";
import { typeDefs } from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers.js";
import { buildContext } from "./auth/requestContext.js";
import { prisma } from "./db/prisma.js";
import multer from "multer";
import { fileURLToPath } from "node:url";

const env = loadEnv();

const dbTarget = (() => {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { configured: false as const };
  try {
    const u = new URL(raw);
    return {
      configured: true as const,
      provider: u.protocol.replace(":", ""),
      user: decodeURIComponent(u.username || ""),
      host: u.hostname,
      port: u.port || "",
      database: u.pathname.replace(/^\//, "")
    };
  } catch {
    return { configured: true as const, provider: "unknown" as const };
  }
})();

try {
  await prisma.$connect();
  logger.info({ db: dbTarget }, "Database connected");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const isAccessDenied = message.includes("P1010") || message.toLowerCase().includes("denied access");
  logger.error(
    {
      err,
      db: dbTarget,
      hint: isAccessDenied
        ? "Check DATABASE_URL points to the right Postgres and that the DB/user exist with CONNECT privileges."
        : "Check DATABASE_URL and that Postgres is running/reachable."
    },
    "Database connection failed"
  );
}

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    // Allow embedding uploaded images (e.g. logo preview) from the web app origin.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const allowedOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
const devLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (env.NODE_ENV !== "production" && devLocalhostOrigin.test(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

// Uploads (product images)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "uploads");
await fs.mkdir(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 10);
      const safeExt = ext && /^[a-zA-Z0-9.]+$/.test(ext) ? ext : "";
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("INVALID_FILE_TYPE"), ok);
  }
});

function requireUploader(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ctx = buildContext({
    env,
    authorizationHeader: req.headers.authorization as string | undefined,
    requestId: (req.headers["x-request-id"] as string) || crypto.randomUUID(),
    ipAddress: req.ip
  });
  if (!ctx.user) return res.status(401).json({ error: "UNAUTHORIZED" });
  if (!["ADMIN", "MANAGER", "STAFF"].includes(String(ctx.user.roleName))) return res.status(403).json({ error: "FORBIDDEN" });
  (req as any).ctx = ctx;
  return next();
}

function requireAuthenticated(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ctx = buildContext({
    env,
    authorizationHeader: req.headers.authorization as string | undefined,
    requestId: (req.headers["x-request-id"] as string) || crypto.randomUUID(),
    ipAddress: req.ip
  });
  if (!ctx.user) return res.status(401).json({ error: "UNAUTHORIZED" });
  (req as any).ctx = ctx;
  return next();
}

app.post("/upload", requireUploader, upload.single("file"), (req, res) => {
  const f = (req as any).file as { filename?: string } | undefined;
  if (!f?.filename) return res.status(400).json({ error: "NO_FILE" });
  return res.json({ url: `/uploads/${f.filename}` });
});

// Profile photo uploads (any authenticated user)
app.post("/upload/profile", requireAuthenticated, upload.single("file"), (req, res) => {
  const f = (req as any).file as { filename?: string } | undefined;
  if (!f?.filename) return res.status(400).json({ error: "NO_FILE" });
  return res.json({ url: `/uploads/${f.filename}` });
});

const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: env.NODE_ENV !== "production",
  plugins: env.NODE_ENV === "production" ? [] : [ApolloServerPluginLandingPageGraphQLPlayground()]
});

await apollo.start();

app.use(
  "/graphql",
  expressMiddleware(apollo, {
    context: async ({ req }) => {
      const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
      return buildContext({
        env,
        authorizationHeader: req.headers.authorization,
        requestId,
        ipAddress: req.ip
      });
    }
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening");
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down");
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
