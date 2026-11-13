import { env } from "../config/env.js";

const uuidParam = {
  name: "id",
  in: "path",
  required: true,
  description: "File ID",
  schema: { type: "string", format: "uuid" },
  example: "3f1c6a2e-8a51-4b7e-9d0a-6f6a1b2c3d4e",
};

const errorResponse = (description, code, message) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: { success: false, error: { code, message } },
    },
  },
});

const validationError = {
  description: "Validation failed",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: [{ location: "body", field: "fileSize", message: "fileSize must be greater than 0" }],
        },
      },
    },
  },
};

const successEnvelope = (dataSchema, extra = {}) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: dataSchema,
    ...extra,
  },
});

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "File Storage API",
    version: "1.0.0",
    description: [
      "Upload files directly to Amazon S3 with presigned URLs, track them in PostgreSQL, and enforce a global storage limit.",
      "",
      "**Upload flow**",
      "1. `POST /api/uploads/presigned-url` — reserves space and returns a presigned `PUT` URL.",
      "2. The client `PUT`s the raw file bytes to `uploadUrl`, sending the returned `Content-Type` header.",
      "3. `POST /api/uploads/complete` — the server verifies the object in S3 and marks the file completed.",
      "",
      "Reservations that are not completed before `completeBefore` are released automatically.",
    ].join("\n"),
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: "Local" }],
  tags: [
    { name: "Uploads", description: "Presigned upload flow" },
    { name: "Files", description: "Browse, download and delete files" },
    { name: "Storage", description: "Storage usage and limits" },
    { name: "Health", description: "Service health" },
  ],
  paths: {
    "/api/uploads/presigned-url": {
      post: {
        tags: ["Uploads"],
        summary: "Generate upload URL and reserve space",
        description:
          "Validates the request, atomically reserves `fileSize` bytes against the storage limit, creates a PENDING file and upload session, and returns a presigned S3 `PUT` URL.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PresignedUrlRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Upload URL generated",
            content: {
              "application/json": {
                schema: successEnvelope({ $ref: "#/components/schemas/PresignedUrlResponse" }),
              },
            },
          },
          400: validationError,
          413: errorResponse(
            "Not enough storage space",
            "STORAGE_LIMIT_EXCEEDED",
            "Not enough storage space. Requested 2 GB, available 1.5 GB.",
          ),
        },
      },
    },
    "/api/uploads/complete": {
      post: {
        tags: ["Uploads"],
        summary: "Verify upload and update database",
        description:
          "Checks that the object exists in S3 with the declared size, marks the file COMPLETED and moves the reserved bytes to used storage. If the object is missing, the session stays PENDING so you can retry. A size mismatch fails the session, deletes the object and releases the reservation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CompleteUploadRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Upload completed",
            content: {
              "application/json": { schema: successEnvelope({ $ref: "#/components/schemas/File" }) },
            },
          },
          400: errorResponse(
            "Validation failed, object not uploaded yet (UPLOAD_NOT_FOUND), or size mismatch (UPLOAD_SIZE_MISMATCH)",
            "UPLOAD_NOT_FOUND",
            "File was not found in storage. Upload it to the presigned URL before completing.",
          ),
          404: errorResponse("Upload session not found", "UPLOAD_SESSION_NOT_FOUND", "Upload session not found"),
          409: errorResponse(
            "Upload already completed",
            "UPLOAD_ALREADY_COMPLETED",
            "This upload has already been completed",
          ),
          410: errorResponse(
            "Upload session expired",
            "UPLOAD_SESSION_EXPIRED",
            "This upload session has expired. Request a new upload URL.",
          ),
        },
      },
    },
    "/api/files": {
      get: {
        tags: ["Files"],
        summary: "Get all uploaded files",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["COMPLETED", "PENDING", "DELETING", "FAILED", "ALL"], default: "COMPLETED" },
          },
          {
            name: "search",
            in: "query",
            description: "Case-insensitive match on the original file name",
            schema: { type: "string", maxLength: 255 },
          },
          {
            name: "sortBy",
            in: "query",
            schema: { type: "string", enum: ["createdAt", "fileSize", "originalName"], default: "createdAt" },
          },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        ],
        responses: {
          200: {
            description: "Paginated list of files",
            content: {
              "application/json": {
                schema: successEnvelope(
                  { type: "array", items: { $ref: "#/components/schemas/File" } },
                  {
                    meta: {
                      type: "object",
                      properties: { pagination: { $ref: "#/components/schemas/Pagination" } },
                    },
                  },
                ),
              },
            },
          },
          400: validationError,
        },
      },
    },
    "/api/files/{id}": {
      get: {
        tags: ["Files"],
        summary: "Get individual file details",
        parameters: [uuidParam],
        responses: {
          200: {
            description: "File details",
            content: {
              "application/json": { schema: successEnvelope({ $ref: "#/components/schemas/File" }) },
            },
          },
          400: validationError,
          404: errorResponse("File not found", "FILE_NOT_FOUND", "File not found"),
        },
      },
      delete: {
        tags: ["Files"],
        summary: "Delete file from S3 and PostgreSQL",
        description: "Deletes the object from S3, removes the database records and frees the used storage.",
        parameters: [uuidParam],
        responses: {
          200: {
            description: "File deleted",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    originalName: { type: "string", example: "report.pdf" },
                    freedBytes: { type: "integer", example: 1048576 },
                  },
                }),
              },
            },
          },
          400: validationError,
          404: errorResponse("File not found", "FILE_NOT_FOUND", "File not found"),
          409: errorResponse(
            "Upload still in progress, or delete already running",
            "FILE_DELETE_IN_PROGRESS",
            "File is already being deleted",
          ),
          502: errorResponse(
            "S3 delete failed",
            "S3_DELETE_FAILED",
            "Failed to delete file from storage. Please try again.",
          ),
        },
      },
    },
    "/api/files/{id}/download-url": {
      get: {
        tags: ["Files"],
        summary: "Generate download URL",
        parameters: [
          uuidParam,
          {
            name: "inline",
            in: "query",
            description: "`true` to let the browser display the file instead of downloading it",
            schema: { type: "string", enum: ["true", "false"], default: "false" },
          },
        ],
        responses: {
          200: {
            description: "Presigned download URL",
            content: {
              "application/json": { schema: successEnvelope({ $ref: "#/components/schemas/DownloadUrlResponse" }) },
            },
          },
          400: errorResponse(
            "File is not COMPLETED",
            "FILE_NOT_AVAILABLE",
            "File is not available for download (status: PENDING)",
          ),
          404: errorResponse("File not found", "FILE_NOT_FOUND", "File not found"),
        },
      },
    },
    "/api/storage": {
      get: {
        tags: ["Storage"],
        summary: "Get storage statistics",
        responses: {
          200: {
            description: "Storage statistics",
            content: {
              "application/json": { schema: successEnvelope({ $ref: "#/components/schemas/StorageStats" }) },
            },
          },
        },
      },
    },
    "/api/storage/limit": {
      patch: {
        tags: ["Storage"],
        summary: "Update storage limit",
        description:
          "Send exactly one of `limitGB` or `limitBytes`. The new limit must be at least the currently used plus reserved storage.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateStorageLimitRequest" },
              examples: {
                gigabytes: { summary: "Set limit in GB", value: { limitGB: 20 } },
                bytes: { summary: "Set limit in bytes", value: { limitBytes: 21474836480 } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Limit updated; returns new statistics",
            content: {
              "application/json": { schema: successEnvelope({ $ref: "#/components/schemas/StorageStats" }) },
            },
          },
          400: errorResponse(
            "Validation failed or limit below current usage",
            "LIMIT_BELOW_USAGE",
            "Storage limit cannot be lower than the space already used or reserved (4.2 GB).",
          ),
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        responses: {
          200: {
            description: "API and database are up",
            content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
          },
          503: {
            description: "Database is unreachable",
            content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      PresignedUrlRequest: {
        type: "object",
        required: ["fileName", "mimeType", "fileSize"],
        properties: {
          fileName: { type: "string", maxLength: 255, example: "report.pdf" },
          mimeType: { type: "string", maxLength: 150, example: "application/pdf" },
          fileSize: {
            type: "integer",
            minimum: 1,
            description: `File size in bytes (max ${env.MAX_FILE_SIZE_MB} MB)`,
            example: 1048576,
          },
        },
      },
      PresignedUrlResponse: {
        type: "object",
        properties: {
          uploadSessionId: { type: "string", format: "uuid" },
          fileId: { type: "string", format: "uuid" },
          uploadUrl: { type: "string", format: "uri", description: "Presigned S3 PUT URL" },
          method: { type: "string", example: "PUT" },
          headers: {
            type: "object",
            description: "Headers the client must send with the PUT request",
            example: { "Content-Type": "application/pdf" },
          },
          s3Key: { type: "string", example: "uploads/2026/11/13/9b2d...-report.pdf" },
          expiresIn: { type: "integer", description: "Seconds until uploadUrl expires", example: 900 },
          expiresAt: { type: "string", format: "date-time" },
          completeBefore: {
            type: "string",
            format: "date-time",
            description: "Deadline for calling /api/uploads/complete",
          },
        },
      },
      CompleteUploadRequest: {
        type: "object",
        required: ["uploadSessionId"],
        properties: {
          uploadSessionId: { type: "string", format: "uuid" },
        },
      },
      File: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "report.pdf", description: "Sanitized name used in the S3 key" },
          originalName: { type: "string", example: "Report (final).pdf" },
          mimeType: { type: "string", example: "application/pdf" },
          extension: { type: "string", nullable: true, example: "pdf" },
          fileSize: { type: "integer", example: 1048576 },
          fileSizeFormatted: { type: "string", example: "1 MB" },
          s3Key: { type: "string" },
          status: { type: "string", enum: ["PENDING", "COMPLETED", "DELETING", "FAILED"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      DownloadUrlResponse: {
        type: "object",
        properties: {
          fileId: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "report.pdf" },
          mimeType: { type: "string", example: "application/pdf" },
          fileSize: { type: "integer", example: 1048576 },
          fileSizeFormatted: { type: "string", example: "1 MB" },
          downloadUrl: { type: "string", format: "uri" },
          expiresIn: { type: "integer", example: 300 },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 42 },
          totalPages: { type: "integer", example: 3 },
          hasNextPage: { type: "boolean", example: true },
          hasPrevPage: { type: "boolean", example: false },
        },
      },
      StorageStats: {
        type: "object",
        properties: {
          totalLimit: { type: "integer", example: 10737418240 },
          usedStorage: { type: "integer", example: 3221225472 },
          reservedStorage: { type: "integer", example: 104857600 },
          availableStorage: { type: "integer", example: 7411335168 },
          usagePercentage: { type: "number", example: 30 },
          committedPercentage: { type: "number", example: 30.98 },
          formatted: {
            type: "object",
            properties: {
              totalLimit: { type: "string", example: "10 GB" },
              usedStorage: { type: "string", example: "3 GB" },
              reservedStorage: { type: "string", example: "100 MB" },
              availableStorage: { type: "string", example: "6.9 GB" },
            },
          },
          fileCount: { type: "integer", example: 128 },
          pendingUploads: { type: "integer", example: 2 },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateStorageLimitRequest: {
        type: "object",
        description: "Provide exactly one of limitGB or limitBytes",
        properties: {
          limitGB: { type: "number", example: 20 },
          limitBytes: { type: "integer", example: 21474836480 },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string", example: "API is healthy" },
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded"] },
              services: {
                type: "object",
                properties: {
                  api: { type: "string", example: "up" },
                  database: { type: "string", enum: ["up", "down"] },
                },
              },
              uptime: { type: "integer", description: "Seconds", example: 3600 },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
};
