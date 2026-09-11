import { Resend } from "resend";
import { reportError } from "@/lib/sentry-report";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "AOTF Admin <noreply@aotf.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function reportEmailFailure(error: unknown, operation: string): void {
  reportError(error, {
    tags: { integration: "resend", operation },
  });
}

/**
 * Send admin account creation email with temporary credentials
 */
export async function sendAdminCreationEmail(params: {
  email: string;
  name: string;
  username: string;
  temporaryPassword: string;
  role: string;
}) {
  const { email, name, username, temporaryPassword, role } = params;

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your AOTF Admin Account  Has Been Created",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to AOTF Admin</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your admin account has been created with the following details:
            </p>
            
            <div style="background: #f7f9fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600;">Role:</td>
                  <td style="padding: 8px 0; text-align: right;">${role.replace("_", " ").toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600;">Username:</td>
                  <td style="padding: 8px 0; text-align: right; font-family: monospace;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600;">Email:</td>
                  <td style="padding: 8px 0; text-align: right;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600;">Temporary Password:</td>
                  <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #e74c3c;">${temporaryPassword}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important Security Notice:</strong><br>
                You must change this temporary password upon your first login. The password above is for one-time use only.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/admin/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Login to Admin Panel
              </a>
            </div>
            
            <div style="background: #f7f9fc; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="margin: 0; font-size: 13px; color: #666;">
                <strong>Security Tips:</strong>
              </p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 13px; color: #666;">
                <li>Never share your credentials with anyone</li>
                <li>Use a unique, strong password</li>
                <li>After 5 failed login attempts, your account will be locked</li>
                <li>Only the superadmin can unlock locked accounts</li>
              </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #666; margin: 0;">
              If you did not request this account or believe this is an error, please contact the superadmin immediately.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>AOTF Admin System • ${new Date().getFullYear()}</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </body>
        </html>
      `,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("[email-service] Error sending admin creation email:", error);
    reportEmailFailure(error, "send-admin-creation-email");
    return {
      success: false,
      error: "Failed to send admin creation email",
    };
  }
}

/**
 * Send password reset notification email
 */
export async function sendPasswordResetNotification(params: {
  email: string;
  name: string;
  resetByAdmin: string;
}) {
  const { email, name, resetByAdmin } = params;

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your AOTF Admin Password Has Been Reset",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Password Reset Required</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your admin account password has been reset by <strong>${resetByAdmin}</strong>.
            </p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Action Required:</strong><br>
                You need to set a new password to access your admin account. Use the "Forgot Password" link on the login page to create a new password.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/admin/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Go to Login Page
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #666; margin: 0;">
              If you did not request this password reset, please contact the superadmin immediately, as this may indicate unauthorized access to your account.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>AOTF Admin System • ${new Date().getFullYear()}</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </body>
        </html>
      `,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error(
      "[email-service] Error sending password reset notification:",
      error,
    );
    reportEmailFailure(error, "send-password-reset-notification");
    return {
      success: false,
      error: "Failed to send password reset notification",
    };
  }
}

/**
 * Send account locked notification
 */
export async function sendAccountLockedEmail(params: {
  email: string;
  name: string;
  reason: "failed_attempts" | "manual";
}) {
  const { email, name, reason } = params;

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your AOTF Admin Account Has Been Locked",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Account Locked</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your admin account has been locked ${reason === "failed_attempts" ? "due to multiple failed login attempts" : "by a superadmin"}.
            </p>
            
            <div style="background: #ffebee; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #c62828;">
                <strong>🔒 Your account is currently locked</strong><br>
                ${reason === "failed_attempts" ? "We detected 5 failed login attempts on your account." : "Your account was manually locked by a superadmin."}
              </p>
            </div>
            
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>What to do next:</strong>
            </p>
            
            <ul style="font-size: 15px; line-height: 1.8;">
              <li>Contact the superadmin to unlock your account</li>
              <li>Verify that recent login attempts were made by you</li>
              <li>Once unlocked, you'll need to set a new password</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #666; margin: 0;">
              If you did not attempt to log in, please contact the superadmin immediately, as this may indicate unauthorized access attempts on your account.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>AOTF Admin System • ${new Date().getFullYear()}</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </body>
        </html>
      `,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error("[email-service] Error sending account locked email:", error);
    reportEmailFailure(error, "send-account-locked-email");
    return {
      success: false,
      error: "Failed to send account locked email",
    };
  }
}

/**
 * Send account unlocked notification
 */
export async function sendAccountUnlockedEmail(params: {
  email: string;
  name: string;
  unlockedBy: string;
}) {
  const { email, name, unlockedBy } = params;

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your AOTF Admin Account Has Been Unlocked",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Account Unlocked</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e8ed; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your admin account has been unlocked by <strong>${unlockedBy}</strong>. You can now access the admin panel again.
            </p>
            
            <div style="background: #d4edda; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #155724;">
                <strong>✅ Your account is now active</strong><br>
                You may need to reset your password before logging in.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/admin/login" style="display: inline-block; background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Login to Admin Panel
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #666; margin: 0;">
              Please ensure you're using a strong, unique password for your account.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>AOTF Admin System • ${new Date().getFullYear()}</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </body>
        </html>
      `,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    console.error(
      "[email-service] Error sending account unlocked email:",
      error,
    );
    reportEmailFailure(error, "send-account-unlocked-email");
    return {
      success: false,
      error: "Failed to send account unlocked email",
    };
  }
}

export async function sendAdminInviteEmail(params: {
  email: string;
  inviteeName: string;
  inviterName: string;
  assignedRoleDisplayName: string;
  joinLink: string;
  expiresAt: Date;
}) {
  const {
    email,
    inviteeName,
    inviterName,
    assignedRoleDisplayName,
    joinLink,
    expiresAt,
  } = params;

  const expiryText = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(expiresAt);

  try {
    const result = await getResend().emails.send({
      from: "AOTF <contact@aotf.in>",
      to: email,
      subject: "Invitation to join AOTF Admin Panel",
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-top: 0;">AOTF Admin Invitation</h2>
          <p>Hi ${inviteeName},</p>
          <p>${inviterName} has invited you to join the AOTF admin panel as <strong>${assignedRoleDisplayName}</strong>.</p>
          <p>
            <a href="${joinLink}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px;">
              Accept Invite
            </a>
          </p>
          <p>This invitation expires on <strong>${expiryText}</strong> (IST).</p>
          <p>If you were not expecting this invite, you can ignore this email.</p>
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #6b7280;">AOTF Admin System</p>
        </div>
      `,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("[email-service] Error sending admin invite email:", error);
    reportEmailFailure(error, "send-admin-invite-email");
    return { success: false, error: "Failed to send admin invite email" };
  }
}
