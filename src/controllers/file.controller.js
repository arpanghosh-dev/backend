import * as fileService from "../services/file.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const listFiles = async (req, res) => {
  const { files, pagination } = await fileService.listFiles(req.validated.query);
  return sendSuccess(res, { message: "Files fetched", data: files, meta: { pagination } });
};

export const getFile = async (req, res) => {
  const data = await fileService.getFileById(req.validated.params.id);
  return sendSuccess(res, { message: "File fetched", data });
};

export const getDownloadUrl = async (req, res) => {
  const data = await fileService.getDownloadUrl(req.validated.params.id, { inline: req.validated.query.inline });
  return sendSuccess(res, { message: "Download URL generated", data });
};

export const deleteFile = async (req, res) => {
  const data = await fileService.deleteFile(req.validated.params.id);
  return sendSuccess(res, { message: "File deleted", data });
};
