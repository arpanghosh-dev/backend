# File Storage Backend

TypeScript + Express 5 + Prisma (PostgreSQL) API for uploading files directly to Amazon S3 using presigned URLs, with a global storage limit.

## Setup

```bash
npm install                # also runs `prisma generate`
cp .env.example .env       # then fill in the values
npm run prisma:migrate     # apply migrations to your database
npm run dev
```

## Scripts

| Script              | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Watches `src/`. On every start/restart runs `tsc --noEmit` first; the server only starts if type checking passes (see `nodemon.json`). |
| `npm run typecheck` | Type-check only, no output files                                             |
| `npm run build`     | Clean `dist/` and compile TypeScript to JavaScript                           |
| `npm start`         | Builds (via `prestart`), then runs `node dist/server.js`                     |

Imports inside `src/` use `.js` extensions (e.g. `./config/env.js`) — this is required for Node ESM with `"module": "NodeNext"`; TypeScript resolves them to the `.ts` files.

- API: `http://localhost:5000/api`
- Swagger UI: `http://localhost:5000/api/docs`
- OpenAPI JSON: `http://localhost:5000/api/docs.json`

## Endpoints

| Method | Endpoint                       | Description                              |
| ------ | ------------------------------ | ---------------------------------------- |
| POST   | `/api/uploads/presigned-url`   | Generate upload URL and reserve space    |
| POST   | `/api/uploads/complete`        | Verify upload and update database        |
| GET    | `/api/files`                   | List files (pagination, search, sorting) |
| GET    | `/api/files/:id`               | Get file details                         |
| GET    | `/api/files/:id/download-url`  | Generate download URL                    |
| DELETE | `/api/files/:id`               | Delete file from S3 and PostgreSQL       |
| GET    | `/api/storage`                 | Storage statistics                       |
| PATCH  | `/api/storage/limit`           | Update storage limit                     |
| GET    | `/api/health`                  | API and database health                  |

## Upload flow

```js
// 1. Ask for an upload URL (space is reserved)
const { data } = await fetch("/api/uploads/presigned-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
}).then((r) => r.json());

// 2. Upload the bytes straight to S3 (Content-Type must match)
await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: file });

// 3. Confirm — the server checks the object exists in S3 with the right size
await fetch("/api/uploads/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ uploadSessionId: data.uploadSessionId }),
});
```

Uploads not completed before `completeBefore` are expired automatically every `CLEANUP_INTERVAL_MINUTES`, and their reserved space is released.

## Storage accounting

`storage_configs` holds a single row with `total_limit`, `used_storage` and `reserved_storage`.
Reservations use one conditional `UPDATE`, so concurrent uploads can never exceed the limit.

| Event                   | reserved | used |
| ----------------------- | -------- | ---- |
| presigned-url           | +size    |      |
| complete                | −size    | +size |
| expired / failed upload | −size    |      |
| delete                  |          | −size |

## S3 bucket CORS

Browsers upload directly to S3, so the bucket needs a CORS rule (S3 console → Bucket → Permissions → CORS):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

The IAM user needs `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`.
`AWS_REGION` must be the bucket's actual region.

## Project structure

```
src/
├── config/        env validation, Prisma client, S3 client, CORS
├── controllers/   HTTP layer (request → service → response)
├── services/      business logic (S3, uploads, files, storage)
├── routes/        Express routers
├── middlewares/   validation and error handling
├── validators/    Zod schemas
├── utils/         S3 keys, byte math, serializers, errors
├── docs/          OpenAPI (Swagger) spec
├── types/         Express type augmentation (req.validated)
├── app.ts         Express app
└── server.ts      entry point, startup and shutdown
```
