const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_CONTACT_RECIPIENT = "daniel@cascademanagement.us";
const DEFAULT_FROM_EMAIL = "Cascade Management & Real Estate Services <onboarding@resend.dev>";

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

function getRecipients(env = {}) {
  return String(env.CONTACT_TO_EMAIL || DEFAULT_CONTACT_RECIPIENT)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function formatInquiryEmail(inquiry) {
  const topic = inquiry.topic || "Not specified";
  const phone = inquiry.phone || "Not provided";

  return [
    "New Cascade Management & Real Estate Services inquiry",
    "",
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Phone: ${phone}`,
    `Topic: ${topic}`,
    `Received: ${inquiry.receivedAt}`,
    "",
    "Message:",
    inquiry.message
  ].join("\n");
}

async function sendInquiryEmail(env = {}, inquiry) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const recipients = getRecipients(env);

  if (!recipients.length) {
    throw new Error("No contact form recipient is configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: recipients,
      reply_to: inquiry.email,
      subject: `New Cascade Management & Real Estate Services inquiry from ${inquiry.name}`,
      text: formatInquiryEmail(inquiry)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend delivery failed (${response.status}): ${errorText}`);
  }
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestPost({ request, env = {} }) {
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

  try {
    await sendInquiryEmail(env, inquiry);
  } catch (deliveryError) {
    console.error("Cascade Management & Real Estate Services contact delivery failed", {
      error: deliveryError.message,
      recipient: getRecipients(env),
      receivedAt: inquiry.receivedAt
    });

    return json(
      {
        error:
          "Sorry, the message could not be sent right now. Please email daniel@cascademanagement.us directly."
      },
      { status: 502 }
    );
  }

  // Avoid logging message bodies in high-volume production unless retention and access controls are defined.
  console.log("Cascade Management & Real Estate Services contact inquiry received", {
    name: inquiry.name,
    email: inquiry.email,
    phoneProvided: Boolean(inquiry.phone),
    topic: inquiry.topic,
    receivedAt: inquiry.receivedAt
  });

  return json(
    {
      message: "Thanks. Your inquiry was sent. Cascade Management & Real Estate Services will follow up shortly."
    },
    { status: 200 }
  );
}

export async function onRequest() {
  return json({ error: "Method not allowed." }, { status: 405 });
}
