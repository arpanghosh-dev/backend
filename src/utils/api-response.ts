import type { Response } from "express";

export interface SuccessOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T | null;
  meta?: Record<string, unknown>;
}

export const sendSuccess = <T>(
  res: Response,
  { statusCode = 200, message = "Success", data, meta }: SuccessOptions<T> = {},
): void => {
  const body: SuccessBody<T> = { success: true, message, data: data ?? null };
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
};
