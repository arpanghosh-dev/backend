import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";
import fileRoutes from "./file.routes.js";
import storageRoutes from "./storage.routes.js";
import uploadRoutes from "./upload.routes.js";

const router: Router = Router();

router.get("/health", healthCheck);
router.use("/uploads", uploadRoutes);
router.use("/files", fileRoutes);
router.use("/storage", storageRoutes);

export default router;
