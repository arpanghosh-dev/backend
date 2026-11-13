import { Router } from "express";
import * as fileController from "../controllers/file.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { downloadUrlSchema, fileIdParamSchema, listFilesSchema } from "../validators/file.validator.js";

const router: Router = Router();

router.get("/", validate(listFilesSchema), fileController.listFiles);
router.get("/:id", validate(fileIdParamSchema), fileController.getFile);
router.get("/:id/download-url", validate(downloadUrlSchema), fileController.getDownloadUrl);
router.delete("/:id", validate(fileIdParamSchema), fileController.deleteFile);

export default router;
