import * as uploadService from "../services/upload.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const createPresignedUrl = async (req, res) => {
  const data = await uploadService.createUploadSession(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "Upload URL generated and storage reserved", data });
};

export const completeUpload = async (req, res) => {
  const data = await uploadService.completeUpload(req.validated.body);
  return sendSuccess(res, { message: "Upload verified and completed", data });
};
