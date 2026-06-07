const MAX_MESSAGE_LENGTH = 2000;

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers || {})
    }
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

function sanitizeInquiry(body) {
  const inquiry = {
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 180).toLowerCase(),
    phone: cleanText(body.phone, 80),
    topic: cleanText(body.topic, 80),
    message: cleanText(body.message, MAX_MESSAGE_LENGTH),
    receivedAt: new Date().toISOString()
  };

  if (!inquiry.name || !isValidEmail(inquiry.email) || inquiry.message.length < 12) {
    return {
      error: "Please include your name, a valid email, and a short message."
    };
  }

  return { inquiry };
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestPost({ request }) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { inquiry, error } = sanitizeInquiry(body);

  if (error) {
    return json({ error }, { status: 400 });
  }

  // Production persistence is intentionally not wired yet.
  // TODO: Send an owner notification via Resend once RESEND_API_KEY and recipient rules are set.
  // TODO: Optionally append sanitized inquiries to Google Sheets for non-technical review.
  // TODO: Optionally store sanitized inquiries in Cloudflare D1 if a durable database is preferred.
  // Avoid logging message bodies in high-volume production unless retention and access controls are defined.
  console.log("Cascade contact inquiry received", {
    name: inquiry.name,
    email: inquiry.email,
    phoneProvided: Boolean(inquiry.phone),
    topic: inquiry.topic,
    receivedAt: inquiry.receivedAt
  });

  return json(
    {
      message:
        "Thanks. Your inquiry was received. Cascade Management will follow up after production notifications are connected."
    },
    { status: 202 }
  );
}

export async function onRequest() {
  return json({ error: "Method not allowed." }, { status: 405 });
}
