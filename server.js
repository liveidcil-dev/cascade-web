const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const HOST = "127.0.0.1";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const MAX_MESSAGE_LENGTH = 2000;
const CONTACT_RECIPIENT = "daniel@cascademanagement.us";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".txt"],
    "Cache-Control": "no-store"
  });
  res.end(message);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

async function handleContact(req, res) {
  const body = await readBody(req);
  const inquiry = {
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 180).toLowerCase(),
    phone: cleanText(body.phone, 80),
    topic: cleanText(body.topic, 80),
    message: cleanText(body.message, MAX_MESSAGE_LENGTH),
    receivedAt: new Date().toISOString()
  };

  if (!inquiry.name || !isValidEmail(inquiry.email) || inquiry.message.length < 12) {
    sendJson(res, 400, {
      error: "Please include your name, a valid email, and a short message."
    });
    return;
  }

  // Local preview mirrors the Cloudflare Pages Function response shape without sending email.
  console.log("Local contact inquiry received", {
    name: inquiry.name,
    email: inquiry.email,
    phoneProvided: Boolean(inquiry.phone),
    topic: inquiry.topic,
    recipient: CONTACT_RECIPIENT,
    receivedAt: inquiry.receivedAt
  });

  sendJson(res, 200, {
    message: "Thanks. Your inquiry was sent. Cascade Management will follow up shortly."
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/contact") {
    await handleContact(req, res);
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}

function safeStaticPath(requestPath) {
  const pathWithoutSlash = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const normalized = path.normalize(pathWithoutSlash);
  return path.join(PUBLIC_DIR, normalized);
}

function parseRangeHeader(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");

  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1)
  };
}

function streamFile(res, filePath, headers, streamOptions = {}) {
  res.writeHead(headers.statusCode, headers.values);
  const stream = fs.createReadStream(filePath, streamOptions);
  stream.on("error", () => {
    if (!res.headersSent) {
      sendText(res, 500, "Internal Server Error");
      return;
    }

    res.destroy();
  });
  stream.pipe(res);
}

async function serveVideo(req, res, filePath, extension, fileSize) {
  const baseHeaders = {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes"
  };
  const range = req.headers.range;

  if (!range) {
    streamFile(res, filePath, {
      statusCode: 200,
      values: {
        ...baseHeaders,
        "Content-Length": fileSize
      }
    });
    return;
  }

  const parsedRange = parseRangeHeader(range, fileSize);

  if (!parsedRange) {
    res.writeHead(416, {
      ...baseHeaders,
      "Content-Range": `bytes */${fileSize}`
    });
    res.end();
    return;
  }

  const { start, end } = parsedRange;

  streamFile(
    res,
    filePath,
    {
      statusCode: 206,
      values: {
        ...baseHeaders,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`
      }
    },
    { start, end }
  );
}

async function serveStatic(req, res, requestPath) {
  const filePath = safeStaticPath(requestPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fsp.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const isHtml = extension === ".html";
    const isVideo = extension === ".mp4" || extension === ".webm";

    if (isVideo) {
      await serveVideo(req, res, filePath, extension, stats.size);
      return;
    }

    const file = await fsp.readFile(filePath);

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": isHtml ? "no-store" : "public, max-age=3600"
    });
    res.end(file);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal Server Error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Cascade Management site running at http://${HOST}:${PORT}`);
});
