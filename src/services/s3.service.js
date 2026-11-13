const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");

const s3 = require("../config/aws");

const BUCKET = process.env.AWS_BUCKET_NAME;

async function generateUploadUrl(key, mimeType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType
  });

  return getSignedUrl(s3, command, {
    expiresIn: 300
  });
}

async function generateDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });

  return getSignedUrl(s3, command, {
    expiresIn: 300
  });
}

async function getFileMetadata(key) {
  return s3.send(
    new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key
    })
  );
}

async function deleteS3File(key) {
  return s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key
    })
  );
}

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  getFileMetadata,
  deleteS3File
};