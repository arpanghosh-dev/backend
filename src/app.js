import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { corsOptions } from "./config/cors.js";
import { swaggerSpec } from "./docs/swagger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import apiRoutes from "./routes/index.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// API docs are mounted before helmet so its Content-Security-Policy doesn't block the Swagger UI assets.
app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "File Storage API Docs",
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  }),
);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.path === "/health",
    message: {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
    },
  }),
);

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
