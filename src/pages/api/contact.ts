/**
 * Contact Form API Endpoint
 *
 * POST /api/contact
 *
 * Validates input, checks honeypot, rate-limits by IP,
 * and delivers the message via Resend to the configured recipient.
 *
 * Astro 6: `export const prerender = false` opts this route into SSR.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// ── Configuration ──

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const CONTACT_EMAIL = import.meta.env.CONTACT_EMAIL || 'nav.vaidhyanathan@vysdom.ai';
const FROM_ADDRESS = 'Vysdom AI Contact <contact@vysdom.ai>';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // max submissions per window per IP

// ── Rate limiter (in-memory — resets on cold start, acceptable for serverless) ──

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// ── Validation ──

const VALID_SUBJECTS = ['general', 'research', 'advisory', 'speaking', 'other'] as const;

interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  _company?: string;
}

function validatePayload(
  data: unknown,
): { success: true; data: ContactPayload } | { success: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid request body.' };
  }

  const { name, email, subject, message, _company } = data as Record<string, unknown>;

  // Name
  if (typeof name !== 'string' || !name.trim()) {
    return { success: false, error: 'Name is required.' };
  }
  if (name.trim().length > 100) {
    return { success: false, error: 'Name must be under 100 characters.' };
  }

  // Email
  if (typeof email !== 'string' || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  // Subject
  if (typeof subject !== 'string' || !VALID_SUBJECTS.includes(subject as any)) {
    return { success: false, error: 'Please select a valid subject.' };
  }

  // Message
  if (typeof message !== 'string' || !message.trim()) {
    return { success: false, error: 'Message is required.' };
  }
  if (message.trim().length < 10) {
    return { success: false, error: 'Message must be at least 10 characters.' };
  }
  if (message.trim().length > 5000) {
    return { success: false, error: 'Message must be under 5,000 characters.' };
  }

  return {
    success: true,
    data: {
      name: name.trim(),
      email: email.trim(),
      subject: subject as string,
      message: message.trim(),
      _company: typeof _company === 'string' ? _company : '',
    },
  };
}

// ── Subject label mapping ──

const SUBJECT_LABELS: Record<string, string> = {
  general: 'General Inquiry',
  research: 'Research Collaboration',
  advisory: 'Technical Advisory',
  speaking: 'Speaking Engagement',
  other: 'Other',
};

// ── Route Handler ──

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate
    const validation = validatePayload(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ success: false, message: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { name, email, subject, message, _company } = validation.data;

    // Honeypot check — if filled, silently succeed (fool the bot)
    if (_company && _company.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message sent successfully.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Rate limiting
    const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Too many submissions. Please try again in 15 minutes.',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check for API key
    if (!RESEND_API_KEY) {
      console.error('[contact] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Contact form is temporarily unavailable. Please email us directly.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Send email via Resend
    const resend = new Resend(RESEND_API_KEY);

    const subjectLabel = SUBJECT_LABELS[subject] || subject;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[Vysdom AI Contact] ${subjectLabel} — ${name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #461e96; margin-bottom: 0.5rem;">New Contact Form Submission</h2>
          <hr style="border: none; border-top: 1px solid #e8e8ed; margin: 1rem 0;" />

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0.5rem 0; font-weight: 600; color: #1d1d1f; width: 100px; vertical-align: top;">Name</td>
              <td style="padding: 0.5rem 0; color: #6e6e73;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 0.5rem 0; font-weight: 600; color: #1d1d1f; vertical-align: top;">Email</td>
              <td style="padding: 0.5rem 0; color: #6e6e73;"><a href="mailto:${escapeHtml(email)}" style="color: #461e96;">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 0.5rem 0; font-weight: 600; color: #1d1d1f; vertical-align: top;">Subject</td>
              <td style="padding: 0.5rem 0; color: #6e6e73;">${escapeHtml(subjectLabel)}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e8e8ed; margin: 1rem 0;" />

          <div style="padding: 1rem; background: #f5f5f7; border-radius: 8px;">
            <p style="font-weight: 600; color: #1d1d1f; margin: 0 0 0.5rem 0;">Message</p>
            <p style="color: #6e6e73; white-space: pre-wrap; margin: 0; line-height: 1.6;">${escapeHtml(message)}</p>
          </div>

          <p style="margin-top: 1.5rem; font-size: 12px; color: #86868b;">
            Submitted via vysdom.ai contact form · IP: ${escapeHtml(ip)}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[contact] Resend error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to send message. Please try again or email us directly.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Message sent successfully.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'An unexpected error occurred. Please try again later.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

// ── HTML escaping for email body ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
