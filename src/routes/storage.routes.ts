import { Router } from "express";
import * as storageController from "../controllers/storage.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateStorageLimitSchema } from "../validators/storage.validator.js";

const router: Router = Router();

router.get("/", storageController.getStorageStats);
router.patch("/limit", validate(updateStorageLimitSchema), storageController.updateStorageLimit);

export default router;
