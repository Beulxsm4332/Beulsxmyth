// ═══════════════════════════════════════════════════════════════
// Beulrock - Email Service (Resend Integration)
// ═══════════════════════════════════════════════════════════════
// Production email service using Resend API.
// Falls back to console/demo mode when RESEND_API_KEY is not set.
// ═══════════════════════════════════════════════════════════════

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'noreply@beulrock.com';
const emailFromName = process.env.EMAIL_FROM_NAME || 'Beulrock';
const fromAddress = `${emailFromName} <${emailFrom}>`;

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendApiKey) return null;
  if (resendClient) return resendClient;
  resendClient = new Resend(resendApiKey);
  return resendClient;
}

function isResendConfigured(): boolean {
  return !!resendApiKey;
}

// ── Send OTP Verification Email ──
interface SendOtpEmailOptions {
  email: string;
  otp: string;
  name?: string;
}

export async function sendOtpEmail({ email, otp, name }: SendOtpEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const client = getResendClient();

  if (!client) {
    // Demo mode: log OTP to console
    console.log(`\n========================================`);
    console.log(`[EMAIL DEMO] OTP for ${email}: ${otp}`);
    console.log(`========================================\n`);

    if (typeof globalThis !== "undefined") {
      const g = globalThis as Record<string, unknown>;
      if (!g.__otpStore) g.__otpStore = {};
      const store = g.__otpStore as Record<string, string>;
      store[email] = otp;
    }

    return { success: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Beulrock - Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; min-height:100vh;">
              <tr>
                <td align="center" style="padding:40px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#111; border:1px solid #222; border-radius:16px; overflow:hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#e74c3c,#c0392b); padding:32px 32px 24px;">
                        <h1 style="margin:0; color:white; font-size:24px; font-weight:700;">Beulrock</h1>
                        <p style="margin:8px 0 0; color:rgba(255,255,255,0.8); font-size:14px;">Verification Code</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:32px;">
                        <p style="margin:0 0 16px; color:#a0a0a0; font-size:14px; line-height:1.6;">
                          Hi${name ? ` ${name}` : ''}, here is your verification code to complete your login:
                        </p>
                        <div style="background-color:#1a1a1a; border:2px dashed #333; border-radius:12px; padding:24px; text-align:center; margin:24px 0;">
                          <span style="font-size:36px; font-weight:700; color:white; letter-spacing:8px; font-family:'Courier New',monospace;">${otp}</span>
                        </div>
                        <p style="margin:0 0 8px; color:#666; font-size:12px; line-height:1.6;">
                          This code expires in <strong style="color:#a0a0a0;">5 minutes</strong>. Do not share this code with anyone.
                        </p>
                        <p style="margin:16px 0 0; color:#666; font-size:12px;">
                          If you did not request this code, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:16px 32px; border-top:1px solid #222;">
                        <p style="margin:0; color:#444; font-size:11px; text-align:center;">
                          Beulrock Game Server Hub &bull; ${new Date().getFullYear()}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Resend] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Failed to send OTP:", message);
    return { success: false, error: message };
  }
}

// ── Generic Email Sender ──
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const client = getResendClient();

  if (!client) {
    console.log(`[EMAIL DEMO] To: ${to}, Subject: ${subject}`);
    return { success: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ── Helper: Get stored OTP (for testing/demo) ──
export function getStoredOtp(email: string): string | undefined {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as Record<string, unknown>;
    const store = (g.__otpStore || {}) as Record<string, string>;
    return store[email];
  }
  return undefined;
}

export { isResendConfigured };
