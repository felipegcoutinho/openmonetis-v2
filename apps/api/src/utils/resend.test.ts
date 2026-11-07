import assert from "node:assert/strict";
import test from "node:test";
import { createResendEmailSender, EmailDeliveryError, readEmailEnvironment } from "./resend";

const message = {
  to: "camila@example.com",
  replyTo: "felipe@example.com",
  subject: "Resumo",
  html: "<p>Oi</p>",
  text: "Oi",
  attachments: [
    {
      fileName: "nubank.png",
      contentBase64: "iVBORw==",
      contentType: "image/png",
      contentId: "om-logos-nubank.png",
    },
    { fileName: "extrato-2026-10.xlsx", contentBase64: "AAAA" },
  ],
  idempotencyKey: "delivery-1",
};

test("is disabled without an API key and a sender address", () => {
  assert.equal(createResendEmailSender({ apiKey: "re_key" }).enabled, false);
  assert.equal(createResendEmailSender({ from: "OpenMonetis <a@b.com>" }).enabled, false);
  assert.equal(createResendEmailSender({ apiKey: "re_key", from: "a@b.com" }).enabled, true);
});

test("sends the message to the Resend API with an idempotency key", async () => {
  let request: { url: string; init: RequestInit } | null = null;
  const sender = createResendEmailSender({
    apiKey: "re_key",
    from: "OpenMonetis <reports@example.com>",
    request: async (url, init) => {
      request = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
    },
  });

  assert.deepEqual(await sender.send(message), { providerMessageId: "email-id" });
  const sentRequest = request as unknown as { url: string; init: RequestInit };
  const headers = sentRequest.init.headers as Record<string, string>;
  const body = JSON.parse(String(sentRequest.init.body));
  assert.equal(sentRequest.url, "https://api.resend.com/emails");
  assert.equal(headers.Authorization, "Bearer re_key");
  assert.equal(headers["Idempotency-Key"], "delivery-1");
  assert.deepEqual(body.to, ["camila@example.com"]);
  assert.equal(body.reply_to, "felipe@example.com");
  assert.deepEqual(body.attachments, [
    {
      filename: "nubank.png",
      content: "iVBORw==",
      content_type: "image/png",
      content_id: "om-logos-nubank.png",
    },
    { filename: "extrato-2026-10.xlsx", content: "AAAA" },
  ]);
});

test("reports provider failures without exposing the response body", async () => {
  const sender = createResendEmailSender({
    apiKey: "re_key",
    from: "a@b.com",
    request: async () => new Response("secret details", { status: 422 }),
  });

  await assert.rejects(
    sender.send(message),
    (error) =>
      error instanceof EmailDeliveryError &&
      error.status === 422 &&
      !error.message.includes("secret"),
  );
});

test("requires a valid sender address whenever the API key is set", () => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  try {
    process.env.RESEND_API_KEY = "re_key";
    delete process.env.EMAIL_FROM;
    assert.throws(() => readEmailEnvironment(), /EMAIL_FROM is required/);
    process.env.EMAIL_FROM = "not an email";
    assert.throws(() => readEmailEnvironment(), /EMAIL_FROM must be/);
    process.env.EMAIL_FROM = "OpenMonetis <reports@example.com>";
    assert.deepEqual(readEmailEnvironment(), {
      apiKey: "re_key",
      from: "OpenMonetis <reports@example.com>",
    });
  } finally {
    for (const [name, value] of [
      ["RESEND_API_KEY", previous.key],
      ["EMAIL_FROM", previous.from],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
