const express = require("express");
const helmet = require("helmet");

const corsMiddleware = require("./config/cors");

const app = express();

app.use(helmet());

app.use(corsMiddleware);

app.use(express.json({
  limit: "1mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "1mb"
}));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "File storage API is running"
  });
});

app.use("/api/uploads", require("./routes/upload.routes"));

app.use("/api/files", require("./routes/file.routes"));

app.use("/api/storage", require("./routes/storage.routes"));

module.exports = app;