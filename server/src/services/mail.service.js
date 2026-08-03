/**
 * mail.service.js
 * Executive-grade, 100% email-client-compatible branded templates for Rayzon P2P.
 * Tested for seamless rendering in Gmail (web & mobile), Outlook, Apple Mail, and Yahoo Mail.
 */

import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter;
const getTransporter = () => {
  if (!config.mail.host || !config.mail.username || !config.mail.password) {
    throw new Error('SMTP settings incomplete — set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env');
  }
  transporter ||= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: { user: config.mail.username, pass: config.mail.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
};

const SEND = (options) => {
  if (!config.mail.enabled) {
    console.log(`[MAIL DISABLED] Skipped email to ${options.to || 'unknown recipient'}: ${options.subject || 'No subject'}`);
    return Promise.resolve({ skipped: true, reason: 'MAIL_ENABLED is not true' });
  }
  return getTransporter().sendMail({
    from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
    ...options,
  });
};

const APP_URL     = process.env.APP_URL || 'http://localhost:3000';
const BRAND_COLOR = '#0d9488'; // Rayzon Teal
const BRAND_DARK  = '#115e59';

export const sendRfqInvitationEmail = ({ to, vendorName, rfqNumber, title, closingDate }) => SEND({
  to,
  subject: `RFQ Invitation ${rfqNumber}: ${title}`,
  html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="color:#0d7676">New Freight RFQ Invitation</h2>
    <p>Hello ${vendorName || 'Freight Partner'},</p>
    <p>You have been invited to submit a quotation for <strong>${rfqNumber}</strong> — ${title}.</p>
    <p>Closing date: <strong>${closingDate ? new Date(closingDate).toLocaleString('en-IN') : 'See portal'}</strong></p>
    <p><a href="${APP_URL}/vendor/rfqs" style="display:inline-block;background:#0d7676;color:white;padding:10px 16px;text-decoration:none;border-radius:8px">Open RFQ Portal</a></p>
  </div>`
});

// ─── Base Outer Frame ──────────────────────────────────────────────────────
const frame = ({ badge, badgeBg = BRAND_COLOR, title, subtitle, body, footer }) => `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">

  <!-- Top Accent Bar -->
  <tr><td style="background:${BRAND_COLOR};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- Header Banner -->
  <tr><td style="background:#111827;padding:24px 28px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="width:36px">
        <div style="width:36px;height:36px;background:${BRAND_COLOR};border-radius:10px;text-align:center;line-height:36px;color:#ffffff;font-weight:900;font-size:13px;letter-spacing:0.5px">P2P</div>
      </td>
      <td style="padding-left:12px">
        <div style="color:#ffffff;font-weight:700;font-size:15px;line-height:1.2">Rayzon Solar P2P</div>
        <div style="color:#9ca3af;font-size:11px;margin-top:2px">Procurement Workflow System</div>
      </td>
      <td align="right">
        <div style="background:${badgeBg};color:#ffffff;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;display:inline-block">${badge}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Main Content Card -->
  <tr><td style="padding:32px 28px">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;letter-spacing:-0.3px">${title}</h1>
    ${subtitle ? `<p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">${subtitle}</p>` : '<div style="margin-bottom:24px"></div>'}
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px">
    <p style="margin:0;font-size:11px;color:#64748b;line-height:1.6">${footer}</p>
    <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">© 2026 Rayzon Solar Limited · Automated Workflow Engine</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

// ─── Reusable Components ───────────────────────────────────────────────────

/** Table Data Box with alternating row shading */
const detailBox = (rows) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:0 0 24px">
${rows.map(([label, value, mono], idx) => `
  <tr style="${idx % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;'}">
    <td style="padding:11px 16px;width:140px;font-size:11px;color:#64748b;vertical-align:middle;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${label}</td>
    <td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;vertical-align:middle;${mono ? 'font-family:Consolas,Monaco,monospace;' : ''}">${value}</td>
  </tr>`).join('')}
</table>`;

/** Modern Horizontal Process Step Badges */
const progressBar = (currentStep, totalSteps, steps = []) => {
  const stepCols = Array.from({ length: totalSteps }, (_, i) => {
    const stepNum = i + 1;
    const isDone = stepNum < currentStep;
    const isCurrent = stepNum === currentStep;

    const label = steps[i]?.title || `Step ${stepNum}`;

    let bg     = '#f8fafc';
    let border = '#e2e8f0';
    let text   = '#64748b';
    let icon   = `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#e2e8f0;color:#64748b;font-size:10px;line-height:20px;text-align:center;font-weight:700">${stepNum}</span>`;

    if (isDone) {
      bg     = '#f0fdf4';
      border = '#bbf7d0';
      text   = '#15803d';
      icon   = `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#10b981;color:#ffffff;font-size:10px;line-height:20px;text-align:center;font-weight:800">✓</span>`;
    } else if (isCurrent) {
      bg     = '#f0fdfa';
      border = '#99f6e4';
      text   = '#0f766e';
      icon   = `<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${BRAND_COLOR};color:#ffffff;font-size:10px;line-height:20px;text-align:center;font-weight:800">${stepNum}</span>`;
    }

    return `
    <td style="padding:0 3px;vertical-align:top">
      <div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 6px;text-align:center">
        <div style="margin-bottom:4px">${icon}</div>
        <div style="font-size:11px;font-weight:700;color:${text};line-height:1.3;white-space:nowrap">${label}</div>
      </div>
    </td>`;
  });

  return `
<div style="margin:0 0 24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">
    <tr>${stepCols.join('')}</tr>
  </table>
</div>`;
};

/** Email-safe CTA Button */
const ctaButton = (label, href, color = BRAND_COLOR) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px">
  <tr><td style="border-radius:10px;background:${color}">
    <a href="${href}" target="_blank" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px">${label} &rarr;</a>
  </td></tr>
</table>`;

/** Email-safe Alert Banner Table */
const alertBanner = (icon, text, bg, border, textColor) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};border:1px solid ${border};border-radius:12px;margin:0 0 24px">
  <tr>
    <td style="padding:14px 0 14px 16px;width:28px;vertical-align:middle;font-size:18px;line-height:1;text-align:center">${icon}</td>
    <td style="padding:14px 16px 14px 8px;font-size:13px;color:${textColor};line-height:1.6;vertical-align:middle;font-weight:500">${text}</td>
  </tr>
</table>`;

// ─── Existing Auth Emails ──────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ to, name, code }) =>
  SEND({
    to,
    subject: `${code} — Password Reset Code`,
    text: `Hello ${name}, your password reset code is ${code}. Valid for 10 minutes.`,
    html: frame({
      badge: 'Account Security', badgeBg: '#4f46e5',
      title: 'Reset your password',
      subtitle: `Hello ${name}, use the verification code below to reset your Rayzon P2P account password.`,
      body: `<div style="padding:24px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;text-align:center">
        <div style="font-size:11px;color:#0f766e;margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Verification Code</div>
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0d9488;font-family:Consolas,Monaco,monospace">${code}</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px">Valid for <strong>10 minutes</strong></div>
      </div>`,
      footer: 'If you did not request this change, please ignore this email. Your password will remain unchanged.'
    }),
  });

export const sendTwoFactorEmail = async ({ to, name, code }) =>
  SEND({
    to,
    subject: `${code} — Sign-in Code`,
    text: `Hello ${name}, your sign-in code is ${code}. Valid for 10 minutes.`,
    html: frame({
      badge: 'Sign-in Security', badgeBg: '#4f46e5',
      title: 'Confirm your sign in',
      subtitle: `Hello ${name}, enter this 2FA code to finish logging in to Rayzon P2P.`,
      body: `<div style="padding:24px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;text-align:center">
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0d9488;font-family:Consolas,Monaco,monospace">${code}</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px">Valid for <strong>10 minutes</strong></div>
      </div>`,
      footer: 'If this sign-in attempt was not you, change your password immediately and contact your IT admin.'
    }),
  });

export const verifyMailTransport = () => getTransporter().verify();

// ─── Workflow Email Triggers ───────────────────────────────────────────────

/**
 * Sent to First-step approver when a new request is created
 */
export const sendNewApprovalRequestEmail = async ({
  to, name, approvalId, type, amount, vendorName, requestedBy,
  stepTitle, stepNum, totalSteps
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => ({ title: i === 0 ? stepTitle : `Step ${i + 1}` }));
  return SEND({
    to,
    subject: `🔔 Action Required: ${approvalId} — ${type} awaits your approval`,
    text: `Hello ${name}, a new ${type} request (${approvalId}) submitted by ${requestedBy} is waiting for your approval at step "${stepTitle}". Amount: ${amount}. Please log in to review.`,
    html: frame({
      badge: '⚡ Action Required', badgeBg: '#dc2626',
      title: 'New approval request needs your review',
      subtitle: `Hello ${name}, a new request has been submitted and is waiting for your decision at <strong>${stepTitle}</strong>.`,
      body: `
        ${progressBar(stepNum, totalSteps, steps)}
        ${detailBox([
          ['Request ID', `<span style="color:#0d9488;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Submitted By', requestedBy],
          ['Your Action Step', `Step ${stepNum} of ${totalSteps} — ${stepTitle}`],
        ])}
        ${alertBanner('📋', `This request is pending at <strong>${stepTitle}</strong>. Please review the details and approve, reject, or return this item.`, '#fff7ed', '#fed7aa', '#9a3412')}
        ${ctaButton('Review & Take Action', `${APP_URL}/approvals?q=${approvalId}`, '#dc2626')}
      `,
      footer: `You received this notification because your role (${name}) is assigned to this approval step.`,
    }),
  });
};

/**
 * Sent to Next-step approver when request advances
 */
export const sendNextApproverEmail = async ({
  to, name, approvalId, type, amount, vendorName, requestedBy,
  stepTitle, stepNum, totalSteps, actingUser
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => ({
    title: i === stepNum - 1 ? stepTitle : `Step ${i + 1}`
  }));
  return SEND({
    to,
    subject: `🔔 Action Needed: ${approvalId} — ${stepTitle} approval required`,
    text: `Hello ${name}, request ${approvalId} (${type}) has advanced to your approval step: ${stepTitle}. Please log in to review it.`,
    html: frame({
      badge: '⚡ Your Turn', badgeBg: '#d97706',
      title: 'Request advanced to your step',
      subtitle: `Hello ${name}, a ${type} request passed the previous approval stage and now requires your sign-off at <strong>${stepTitle}</strong>.`,
      body: `
        ${progressBar(stepNum, totalSteps, steps)}
        ${detailBox([
          ['Request ID', `<span style="color:#0d9488;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Submitted By', requestedBy],
          ['Prev. Approved By', actingUser],
          ['Current Step', `Step ${stepNum} of ${totalSteps} — ${stepTitle}`],
        ])}
        ${alertBanner('🟡', `Step ${stepNum - 1} was approved by <strong>${actingUser}</strong>. The request is now awaiting your action for <strong>${stepTitle}</strong>.`, '#fffbeb', '#fde68a', '#92400e')}
        ${ctaButton('Open & Take Action', `${APP_URL}/approvals?q=${approvalId}`, '#d97706')}
      `,
      footer: 'You received this notification because the approval workflow has advanced to your assigned step.',
    }),
  });
};

/**
 * Sent to Requester when one step is approved
 */
export const sendStepProgressEmail = async ({
  to, name, approvalId, type, amount, vendorName, actingUser,
  completedStepNum, completedStepTitle, nextStepNum, nextStepTitle, totalSteps
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => ({
    title: i === completedStepNum - 1 ? completedStepTitle
      : i === nextStepNum - 1 ? nextStepTitle
      : `Step ${i + 1}`
  }));

  return SEND({
    to,
    subject: `✅ Step ${completedStepNum}/${totalSteps} Approved — ${approvalId} moving forward`,
    text: `Hello ${name}, Step ${completedStepNum} of your ${type} request (${approvalId}) has been approved by ${actingUser}. It has moved to Step ${nextStepNum}: ${nextStepTitle}.`,
    html: frame({
      badge: `Step ${completedStepNum}/${totalSteps} Approved`, badgeBg: '#059669',
      title: `Step ${completedStepNum} approved — moving forward!`,
      subtitle: `Hello ${name}, Step ${completedStepNum} of your request has been approved and is advancing through the workflow.`,
      body: `
        ${progressBar(completedStepNum + 1, totalSteps, steps)}
        ${detailBox([
          ['Request ID', `<span style="color:#0d9488;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Step Approved', `Step ${completedStepNum} — ${completedStepTitle}`],
          ['Approved By', actingUser],
          ['Next Step', `Step ${nextStepNum} — ${nextStepTitle}`],
        ])}
        ${alertBanner('✅', `<strong>${completedStepTitle}</strong> was approved by <strong>${actingUser}</strong>. Your request is now with <strong>${nextStepTitle}</strong> for Step ${nextStepNum} review.`, '#f0fdf4', '#bbf7d0', '#166534')}
      `,
      footer: 'This is an automated workflow status update. No action is required from you at this stage.',
    }),
  });
};

/**
 * Sent to Requester when request is fully approved
 */
export const sendApprovalCompleteEmail = async ({
  to, name, approvalId, type, amount, vendorName, actingUser, totalSteps = 2
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => ({ title: `Step ${i + 1}` }));
  return SEND({
    to,
    subject: `🎉 Approved! ${approvalId} — ${type} fully approved & dispatched`,
    text: `Hello ${name}, your ${type} request (${approvalId}) has completed all approval steps and is Approved & Dispatched!`,
    html: frame({
      badge: '🎉 Fully Approved', badgeBg: '#059669',
      title: 'Your request is fully approved!',
      subtitle: `Congratulations ${name}! Your ${type} request completed all ${totalSteps} approval stages and is now approved & dispatched.`,
      body: `
        ${progressBar(totalSteps + 1, totalSteps, steps)}
        ${detailBox([
          ['Request ID', `<span style="color:#0d9488;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Final Approval By', actingUser],
          ['Status', '<span style="color:#059669;font-weight:800">Approved &amp; Dispatched ✓</span>'],
        ])}
        ${alertBanner('🎉', `Your request successfully passed all <strong>${totalSteps} approval stages</strong> and is now <strong>Approved &amp; Dispatched</strong>. Operations and Finance will process execution.`, '#f0fdf4', '#bbf7d0', '#166534')}
      `,
      footer: 'This is an automated completion notice. Relevant finance & operational teams have been notified.',
    }),
  });
};

/**
 * Sent to Requester when request is rejected
 */
export const sendApprovalRejectedEmail = async ({
  to, name, approvalId, type, amount, vendorName, actingUser, stepNum, stepTitle, remarks
}) =>
  SEND({
    to,
    subject: `❌ Rejected: ${approvalId} — ${type} request was rejected`,
    text: `Hello ${name}, your ${type} request (${approvalId}) was rejected at step "${stepTitle}" by ${actingUser}. Remarks: ${remarks || 'None'}`,
    html: frame({
      badge: '❌ Rejected', badgeBg: '#dc2626',
      title: 'Your request was rejected',
      subtitle: `Hello ${name}, your ${type} request was rejected at <strong>${stepTitle}</strong>.`,
      body: `
        ${detailBox([
          ['Request ID', `<span style="color:#dc2626;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Rejected At', `Step ${stepNum} — ${stepTitle}`],
          ['Rejected By', actingUser],
        ])}
        ${remarks ? alertBanner('💬', `<strong>Reason given:</strong><br>"${remarks}"`, '#fff1f2', '#fecdd3', '#9f1239') : ''}
        ${alertBanner('ℹ️', 'If you have questions regarding this decision, please contact your approver directly.', '#f8fafc', '#e2e8f0', '#475569')}
      `,
      footer: 'This is an automated notification regarding your submitted request.',
    }),
  });

/**
 * Sent to Requester when request is returned for changes
 */
export const sendReturnedEmail = async ({
  to, name, approvalId, type, amount, vendorName, actingUser, remarks
}) =>
  SEND({
    to,
    subject: `↩ Changes Needed: ${approvalId} — ${type} returned for revision`,
    text: `Hello ${name}, your ${type} request (${approvalId}) was returned for changes by ${actingUser}. Remarks: ${remarks || 'None'}`,
    html: frame({
      badge: '↩ Changes Needed', badgeBg: '#d97706',
      title: 'Your request needs revisions',
      subtitle: `Hello ${name}, your ${type} request was returned for changes by <strong>${actingUser}</strong>.`,
      body: `
        ${detailBox([
          ['Request ID', `<span style="color:#0d9488;font-weight:800">${approvalId}</span>`, true],
          ['Type', type],
          ['Amount', `<span style="font-weight:700;color:#0f172a">${amount || '—'}</span>`, true],
          ['Vendor', vendorName || '—'],
          ['Returned By', actingUser],
        ])}
        ${remarks ? alertBanner('📝', `<strong>Remarks from approver:</strong><br>"${remarks}"`, '#fffbeb', '#fde68a', '#78350f') : ''}
        ${ctaButton('View & Revise Request', `${APP_URL}/approvals?q=${approvalId}`, '#d97706')}
      `,
      footer: 'Please update your request in Rayzon P2P based on the remarks above and resubmit.',
    }),
  });
