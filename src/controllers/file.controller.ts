import type { Request, Response } from "express";
import * as fileService from "../services/file.service.js";
import { sendSuccess } from "../utils/api-response.js";
import type { DownloadUrlQuery, FileIdParams, ListFilesQuery } from "../validators/file.validator.js";

export const listFiles = async (req: Request, res: Response): Promise<void> => {
  const { files, pagination } = await fileService.listFiles(req.validated.query as ListFilesQuery);
  sendSuccess(res, { message: "Files fetched", data: files, meta: { pagination } });
};

export const getFile = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.validated.params as FileIdParams;
  const data = await fileService.getFileById(id);
  sendSuccess(res, { message: "File fetched", data });
};

export const getDownloadUrl = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.validated.params as FileIdParams;
  const { inline } = req.validated.query as DownloadUrlQuery;
  const data = await fileService.getDownloadUrl(id, { inline });
  sendSuccess(res, { message: "Download URL generated", data });
};

export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.validated.params as FileIdParams;
  const data = await fileService.deleteFile(id);
  sendSuccess(res, { message: "File deleted", data });
};
