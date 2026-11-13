import * as storageService from "../services/storage.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { gbToBytes } from "../utils/storage-calculator.js";

export const getStorageStats = async (_req, res) => {
  const data = await storageService.getStorageStats();
  return sendSuccess(res, { message: "Storage statistics fetched", data });
};

export const updateStorageLimit = async (req, res) => {
  const { limitGB, limitBytes } = req.validated.body;
  const bytes = limitBytes !== undefined ? BigInt(limitBytes) : gbToBytes(limitGB);

  const data = await storageService.updateStorageLimit(bytes);
  return sendSuccess(res, { message: "Storage limit updated", data });
};
