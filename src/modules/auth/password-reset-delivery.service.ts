import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type PasswordResetEmailMode = "disabled" | "log" | "webhook" | "brevo";

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  private getMode(): PasswordResetEmailMode {
    const raw = String(this.config.get<string>("app.passwordResetEmailMode") ?? "disabled")
      .trim()
      .toLowerCase();

    if (raw === "log" || raw === "webhook" || raw === "brevo") return raw;
    return "disabled";
  }

  async sendResetLink(email: string, resetUrl: string): Promise<void> {
    const mode = this.getMode();
    if (mode === "disabled") return;

    if (mode === "log") {
      this.logger.log(`Password reset requested for ${email} (log mode, URL redacted)`);
      return;
    }

    if (mode === "brevo") {
      await this.sendViaBrevo(email, resetUrl);
      return;
    }

    const webhookUrl = this.config.get<string>("app.passwordResetEmailWebhookUrl");
    if (!webhookUrl) {
      this.logger.warn("PASSWORD_RESET_EMAIL_WEBHOOK_URL is not configured");
      return;
    }

    const subject =
      this.config.get<string>("app.passwordResetEmailSubject") ??
      "Reset your De'ciZhen password";
    const from = this.config.get<string>("app.passwordResetEmailFrom") ?? "noreply@decizhen.local";
    const bearer = this.config.get<string>("app.passwordResetEmailWebhookBearer");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        text: `Use this link to reset your password: ${resetUrl}`,
        html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        template: "password-reset",
        variables: { resetUrl, email },
      }),
    });

    if (!res.ok) {
      const payload = await res.text().catch(() => "");
      this.logger.error(
        `Password reset email webhook failed: ${res.status} ${res.statusText} ${payload}`.trim(),
      );
    }
  }

  private async sendViaBrevo(email: string, resetUrl: string): Promise<void> {
    const apiUrl =
      this.config.get<string>("app.passwordResetBrevoApiUrl") ??
      "https://api.brevo.com/v3/smtp/email";
    const apiKey = this.config.get<string>("app.passwordResetBrevoApiKey");
    const fromEmail = this.config.get<string>("app.passwordResetEmailFrom");
    const fromName =
      this.config.get<string>("app.passwordResetEmailFromName") ?? "De'ciZhen";
    const subject =
      this.config.get<string>("app.passwordResetEmailSubject") ??
      "Reset your De'ciZhen password";

    if (!apiKey || !fromEmail) {
      this.logger.warn(
        "Brevo email mode requires PASSWORD_RESET_BREVO_API_KEY and PASSWORD_RESET_EMAIL_FROM",
      );
      return;
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email }],
        subject,
        textContent: `Use this link to reset your password: ${resetUrl}`,
        htmlContent: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      }),
    });

    if (!res.ok) {
      const payload = await res.text().catch(() => "");
      this.logger.error(
        `Brevo password reset email failed: ${res.status} ${res.statusText} ${payload}`.trim(),
      );
    }
  }
}
