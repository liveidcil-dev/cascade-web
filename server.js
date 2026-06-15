const http = require("http");
const fs = require("fs/promises");
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

async function serveStatic(res, requestPath) {
  const filePath = safeStaticPath(requestPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const isHtml = extension === ".html";

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

    await serveStatic(res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal Server Error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Cascade Management site running at http://${HOST}:${PORT}`);
});
