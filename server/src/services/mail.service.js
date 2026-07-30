import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter;

const getTransporter = () => {
  if (!config.mail.host || !config.mail.username || !config.mail.password) {
    throw new Error('SMTP settings are incomplete.');
  }
  transporter ||= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: {
      user: config.mail.username,
      pass: config.mail.password
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  return transporter;
};

const emailFrame = ({ eyebrow, title, intro, content, footer }) => `
<!doctype html>
<html lang="en">
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f8fafc">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#f0fdfa,#ffffff)">
          <table role="presentation"><tr>
            <td style="width:44px;height:44px;border-radius:14px;background:#0d9488;color:#fff;text-align:center;font-weight:800">P2</td>
            <td style="padding-left:12px"><strong style="font-size:16px">Rayzon P2P</strong><br><span style="font-size:12px;color:#64748b">Procurement workspace</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 8px;color:#0f766e;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">${eyebrow}</p>
          <h1 style="margin:0;font-size:24px;line-height:1.3">${title}</h1>
          <p style="margin:12px 0 20px;color:#475569;font-size:14px;line-height:1.6">${intro}</p>
          ${content}
          <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6">${footer}</p>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">© 2026 Rayzon Solar Limited · Automated security message</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const sendPasswordResetEmail = async ({ to, name, code }) => {
  const html = emailFrame({
    eyebrow: 'Account recovery',
    title: 'Reset your password',
    intro: `Hello ${name}, use the verification code below to reset your Rayzon P2P password.`,
    content: `<div style="padding:20px;border:1px solid #99f6e4;border-radius:14px;background:#f0fdfa;text-align:center"><span style="display:block;color:#64748b;font-size:12px;margin-bottom:8px">Verification code</span><strong style="font-size:30px;letter-spacing:8px;color:#0f766e">${code}</strong><span style="display:block;color:#64748b;font-size:12px;margin-top:8px">Valid for 10 minutes</span></div>`,
    footer: 'If you did not request this change, you can safely ignore this email. Never share this code with anyone.'
  });
  return getTransporter().sendMail({
    from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
    to,
    subject: `${code} is your Rayzon P2P password reset code`,
    text: `Hello ${name}, your Rayzon P2P password reset code is ${code}. It expires in 10 minutes.`,
    html
  });
};

export const sendTwoFactorEmail = async ({ to, name, code }) => {
  const html = emailFrame({
    eyebrow: 'Sign-in verification',
    title: 'Confirm your sign in',
    intro: `Hello ${name}, enter this code to finish signing in to Rayzon P2P.`,
    content: `<div style="padding:20px;border:1px solid #99f6e4;border-radius:14px;background:#f0fdfa;text-align:center"><strong style="font-size:30px;letter-spacing:8px;color:#0f766e">${code}</strong><span style="display:block;color:#64748b;font-size:12px;margin-top:8px">Valid for 10 minutes</span></div>`,
    footer: 'If this was not you, change your password immediately and contact your administrator.'
  });
  return getTransporter().sendMail({
    from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
    to,
    subject: `${code} is your Rayzon P2P sign-in code`,
    text: `Hello ${name}, your Rayzon P2P sign-in code is ${code}. It expires in 10 minutes.`,
    html
  });
};

export const verifyMailTransport = () => getTransporter().verify();
