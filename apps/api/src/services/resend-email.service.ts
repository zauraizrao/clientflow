import { env } from "../config/env.js";

type ResendPayload = {
  id?: unknown;
  message?: unknown;
  name?: unknown;
  statusCode?: unknown;
};

export type NotificationEmailInput = {
  notificationId: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  recipientEmail: string;
  recipientName: string | null;
};

export type NotificationEmailResult = {
  providerMessageId: string;
  deliveredTo: string;
  sandbox: boolean;
};

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeActionPath(
  link: string | null,
): string {
  if (link?.startsWith("/app")) {
    return link;
  }

  return "/app/notifications";
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function payloadMessage(
  payload: ResendPayload | null,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload.name === "string"
  ) {
    return payload.name;
  }

  return fallback;
}

function requireConfiguration(): {
  apiKey: string;
  from: string;
  toSandbox: string | null;
  sandbox: boolean;
} {
  if (env.EMAIL_DELIVERY_MODE === "disabled") {
    throw new Error(
      "Email delivery is disabled.",
    );
  }

  if (!env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is required when email delivery is enabled.",
    );
  }

  if (env.EMAIL_DELIVERY_MODE === "sandbox") {
    if (!env.RESEND_SANDBOX_RECIPIENT) {
      throw new Error(
        "RESEND_SANDBOX_RECIPIENT is required in sandbox mode.",
      );
    }

    return {
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
      toSandbox:
        env.RESEND_SANDBOX_RECIPIENT,
      sandbox: true,
    };
  }

  if (
    env.RESEND_FROM.includes(
      "@resend.dev",
    )
  ) {
    throw new Error(
      "Live email mode requires RESEND_FROM to use a verified custom domain.",
    );
  }

  return {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM,
    toSandbox: null,
    sandbox: false,
  };
}

export const resendEmailService = {
  isEnabled(): boolean {
    return (
      env.EMAIL_DELIVERY_MODE !==
      "disabled"
    );
  },

  mode():
    | "disabled"
    | "sandbox"
    | "live" {
    return env.EMAIL_DELIVERY_MODE;
  },

  async sendNotification(
    input: NotificationEmailInput,
  ): Promise<NotificationEmailResult> {
    const config =
      requireConfiguration();

    const deliveredTo =
      config.sandbox
        ? config.toSandbox!
        : input.recipientEmail;

    const actionUrl = new URL(
      safeActionPath(input.link),
      env.APP_BASE_URL,
    ).toString();

    const subject = config.sandbox
      ? `[ClientFlow sandbox → ${input.recipientEmail}] ${input.title}`
      : input.title;

    const recipientLabel =
      input.recipientName?.trim() ||
      input.recipientEmail;

    const bodyText =
      input.body?.trim() ||
      "There is a new update in ClientFlow.";

    const sandboxNote = config.sandbox
      ? `<div style="margin:0 0 18px;padding:10px 12px;border:1px solid #d9dbd3;border-radius:8px;background:#f6f6f2;color:#6d7169;font-size:12px;line-height:18px;">
          Sandbox delivery. Production recipient:
          <strong>${escapeHtml(input.recipientEmail)}</strong>
        </div>`
      : "";

    const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6f6f2;font-family:Arial,sans-serif;color:#191a17;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fcfcf9;border:1px solid #d9dbd3;border-radius:12px;">
            <tr>
              <td style="padding:28px;">
                <div style="margin-bottom:24px;color:#235f55;font-size:14px;font-weight:700;">ClientFlow</div>
                ${sandboxNote}
                <div style="color:#6d7169;font-size:12px;margin-bottom:8px;">${escapeHtml(input.category)}</div>
                <h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#191a17;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#6d7169;">Hi ${escapeHtml(recipientLabel)},</p>
                <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#191a17;">${escapeHtml(bodyText)}</p>
                <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#235f55;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;">Open in ClientFlow</a>
                <div style="margin-top:26px;padding-top:18px;border-top:1px solid #d9dbd3;color:#6d7169;font-size:11px;line-height:17px;">
                  Notification type: ${escapeHtml(input.type)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      "ClientFlow",
      "",
      config.sandbox
        ? `SANDBOX — production recipient: ${input.recipientEmail}`
        : "",
      input.title,
      "",
      `Hi ${recipientLabel},`,
      bodyText,
      "",
      `Open in ClientFlow: ${actionUrl}`,
      "",
      `Notification type: ${input.type}`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    let response: Response;

    try {
      response = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${config.apiKey}`,
            "Content-Type":
              "application/json",
            "Idempotency-Key":
              `clientflow-email/${input.notificationId}`,
          },
          body: JSON.stringify({
            from: config.from,
            to: [deliveredTo],
            subject,
            html,
            text,
          }),
        },
      );
    } catch (error) {
      throw new Error(
        `Resend network error: ${errorMessage(error)}`,
      );
    }

    const raw = await response.text();

    let payload: ResendPayload | null =
      null;

    if (raw) {
      try {
        payload =
          JSON.parse(raw) as ResendPayload;
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        `Resend ${response.status}: ${payloadMessage(
          payload,
          raw ||
            response.statusText ||
            "Email send failed.",
        )}`,
      );
    }

    if (
      !payload ||
      typeof payload.id !== "string"
    ) {
      throw new Error(
        "Resend returned a successful response without an email ID.",
      );
    }

    return {
      providerMessageId: payload.id,
      deliveredTo,
      sandbox: config.sandbox,
    };
  },
};
