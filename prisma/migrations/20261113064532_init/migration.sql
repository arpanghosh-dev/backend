-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'COMPLETED', 'DELETING', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "storage_configs" (
    "id" UUID NOT NULL,
    "total_limit" BIGINT NOT NULL DEFAULT 10737418240,
    "used_storage" BIGINT NOT NULL DEFAULT 0,
    "reserved_storage" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "storage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "extension" VARCHAR(20),
    "s3_bucket" VARCHAR(255) NOT NULL,
    "s3_key" VARCHAR(1024) NOT NULL,
    "etag" VARCHAR(255),
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "expected_size" BIGINT NOT NULL,
    "s3_key" VARCHAR(1024) NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_s3_key_key" ON "files"("s3_key");

-- CreateIndex
CREATE INDEX "files_status_created_at_idx" ON "files"("status", "created_at");

-- CreateIndex
CREATE INDEX "upload_sessions_file_id_idx" ON "upload_sessions"("file_id");

-- CreateIndex
CREATE INDEX "upload_sessions_status_expires_at_idx" ON "upload_sessions"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
