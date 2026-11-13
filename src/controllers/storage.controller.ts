import type { Request, Response } from "express";
import * as storageService from "../services/storage.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { gbToBytes } from "../utils/storage-calculator.js";
import type { UpdateStorageLimitBody } from "../validators/storage.validator.js";

export const getStorageStats = async (_req: Request, res: Response): Promise<void> => {
  const data = await storageService.getStorageStats();
  sendSuccess(res, { message: "Storage statistics fetched", data });
};

export const updateStorageLimit = async (req: Request, res: Response): Promise<void> => {
  const { limitGB, limitBytes } = req.validated.body as UpdateStorageLimitBody;
  // The validator guarantees exactly one of the two is present.
  const bytes = limitBytes !== undefined ? BigInt(limitBytes) : gbToBytes(limitGB ?? 0);

  const data = await storageService.updateStorageLimit(bytes);
  sendSuccess(res, { message: "Storage limit updated", data });
};
