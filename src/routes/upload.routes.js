import { Router } from "express";
import * as uploadController from "../controllers/upload.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { completeUploadSchema, presignedUrlSchema } from "../validators/upload.validator.js";

const router = Router();

router.post("/presigned-url", validate(presignedUrlSchema), uploadController.createPresignedUrl);
router.post("/complete", validate(completeUploadSchema), uploadController.completeUpload);

export default router;
