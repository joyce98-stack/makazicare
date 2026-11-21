const configured = (value) => String(value || "").trim();

async function sendEmail({ to, subject, text }) {
  const apiKey = configured(process.env.RESEND_API_KEY);
  const from = configured(process.env.EMAIL_FROM);
  if (!apiKey || !from) return { status: "not_configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!response.ok) return { status: "failed", reason: `Email provider returned ${response.status}.` };
    return { status: "sent" };
  } catch {
    return { status: "failed", reason: "Email provider could not be reached." };
  }
}

async function sendSms({ to, text }) {
  const sid = configured(process.env.TWILIO_ACCOUNT_SID);
  const token = configured(process.env.TWILIO_AUTH_TOKEN);
  const from = configured(process.env.TWILIO_PHONE_NUMBER);
  if (!sid || !token || !from) return { status: to ? "not_configured" : "no_phone" };
  if (!to) return { status: "no_phone" };
  try {
    const body = new URLSearchParams({ To: to, From: from, Body: text });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return { status: "failed", reason: `SMS provider returned ${response.status}.` };
    return { status: "sent" };
  } catch {
    return { status: "failed", reason: "SMS provider could not be reached." };
  }
}

export async function sendOnboardingNotifications({ name, email, phone, role, details, acceptanceUrl }) {
  const title = role === "tenant" ? "tenant" : "property manager";
  const emailResult = await sendEmail({
    to: email,
    subject: `Your Makazi Care ${title} account`,
    text: `Hello ${name},\n\nA landlord has onboarded you as a ${title} on Makazi Care.\n${details}\n\nSet up your account: ${acceptanceUrl}\n\nIf you were not expecting this invitation, you can ignore this message.`,
  });
  const smsResult = await sendSms({
    to: phone,
    text: `Makazi Care: ${name}, you were onboarded as a ${title}. ${details} Set up your account: ${acceptanceUrl}`,
  });
  return { email: emailResult, sms: smsResult };
}
