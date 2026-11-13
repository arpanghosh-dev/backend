import type { Request, Response } from "express";
import * as uploadService from "../services/upload.service.js";
import { sendSuccess } from "../utils/api-response.js";
import type { CompleteUploadBody, PresignedUrlBody } from "../validators/upload.validator.js";

export const createPresignedUrl = async (req: Request, res: Response): Promise<void> => {
  const data = await uploadService.createUploadSession(req.validated.body as PresignedUrlBody);
  sendSuccess(res, { statusCode: 201, message: "Upload URL generated and storage reserved", data });
};

export const completeUpload = async (req: Request, res: Response): Promise<void> => {
  const data = await uploadService.completeUpload(req.validated.body as CompleteUploadBody);
  sendSuccess(res, { message: "Upload verified and completed", data });
};
