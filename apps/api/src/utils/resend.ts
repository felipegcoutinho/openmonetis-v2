import type { EmailMessage, EmailSender } from "../services/person-reports.service";

const resendEmailsUrl = "https://api.resend.com/emails";
const requestTimeoutMs = 15_000;

export class EmailDeliveryError extends Error {
  constructor(readonly status: number | null) {
    super(status ? `Email provider responded with ${status}` : "Email provider unreachable");
    this.name = "EmailDeliveryError";
  }
}

/** Calls the Resend HTTP API directly, so no SDK dependency is needed. */
export function createResendEmailSender(options: {
  apiKey?: string;
  from?: string;
  request?: typeof fetch;
}): EmailSender {
  const apiKey = options.apiKey?.trim();
  const from = options.from?.trim();
  const request = options.request ?? fetch;

  return {
    enabled: Boolean(apiKey && from),
    async send(message: EmailMessage) {
      if (!apiKey || !from) throw new EmailDeliveryError(null);

      let response: Response;
      try {
        response = await request(resendEmailsUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            reply_to: message.replyTo ?? undefined,
            subject: message.subject,
            html: message.html,
            text: message.text,
            attachments: message.attachments?.map((attachment) => ({
              filename: attachment.fileName,
              content: attachment.contentBase64,
              content_type: attachment.contentType,
              content_id: attachment.contentId,
            })),
          }),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch {
        throw new EmailDeliveryError(null);
      }

      if (!response.ok) throw new EmailDeliveryError(response.status);
      const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
      return { providerMessageId: typeof payload?.id === "string" ? payload.id : null };
    },
  };
}

export function readEmailEnvironment() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (apiKey && !from) throw new Error("EMAIL_FROM is required when RESEND_API_KEY is set");
  if (from && !/^[^<>@\s]+@[^<>@\s]+$|^[^<>]+<[^<>@\s]+@[^<>@\s]+>$/.test(from)) {
    throw new Error('EMAIL_FROM must be an email address or "Name <email>"');
  }
  return { apiKey, from };
}
