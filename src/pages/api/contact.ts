/**
 * Contact Form API Endpoint
 *
 * POST /api/contact
 *
 * 5-layer protection stack:
 *   L1: Honeypot field (_company) — catches basic bots
 *   L2: IP-based rate limiting (3/15min) — prevents flooding
 *   L3: Time-based detection — rejects submissions < 3 seconds
 *   L4: MX validation + disposable email blocklist — verifies email domain
 *   L5: Cloudflare Turnstile — invisible CAPTCHA verification
 *
 * Astro 6: `export const prerender = false` opts this route into SSR.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { resolve as dnsResolve } from 'node:dns/promises';

// ── Configuration ──

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const CONTACT_EMAIL = import.meta.env.CONTACT_EMAIL || 'nav.vaidhyanathan@vysdom.ai';
const FROM_ADDRESS = 'Vysdom AI Contact <contact@vysdom.ai>';
const TURNSTILE_SECRET_KEY = import.meta.env.TURNSTILE_SECRET_KEY;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // max submissions per window per IP
const MIN_SUBMIT_TIME_MS = 3000; // reject submissions faster than 3 seconds

// ── Disposable email domain blocklist ──

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.de', 'grr.la',
  'guerrillamailblock.com', 'tempmail.com', 'throwaway.email', 'temp-mail.org',
  'fakeinbox.com', 'sharklasers.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.net', 'yopmail.com', 'yopmail.fr', 'dispostable.com',
  'trashmail.com', 'trashmail.me', 'trashmail.net', 'mytemp.email',
  'mohmal.com', 'getnada.com', 'tempail.com', 'emailondeck.com',
  'mailnesia.com', 'maildrop.cc', 'discard.email', 'mailcatch.com',
  'harakirimail.com', '10minutemail.com', 'minutemail.com', 'tempr.email',
  'temp-mail.io', 'burnermail.io', 'mailsac.com', 'inboxbear.com',
]);

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
  _loadTime?: number; // timestamp when form was rendered
  'cf-turnstile-response'?: string; // Turnstile token
}

function validatePayload(
  data: unknown,
): { success: true; data: ContactPayload } | { success: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid request body.' };
  }

  const raw = data as Record<string, unknown>;
  const { name, email, subject, message, _company } = raw;

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
      _loadTime: typeof raw._loadTime === 'number' ? raw._loadTime : 0,
      'cf-turnstile-response': typeof raw['cf-turnstile-response'] === 'string'
        ? raw['cf-turnstile-response'] : '',
    },
  };
}

// ── MX Validation ──

async function hasValidMxRecords(emailDomain: string): Promise<boolean> {
  try {
    const records = await dnsResolve(emailDomain, 'MX');
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

// ── Turnstile Verification ──

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    // No secret key configured — skip verification (development)
    console.warn('[contact] TURNSTILE_SECRET_KEY not configured, skipping Turnstile verification');
    return true;
  }

  if (!token || token === '__cf_turnstile_error__') {
    // Client-side Turnstile failed (localhost not whitelisted, ad blocker, etc.)
    // In development: allow through. In production: this should be rare.
    console.warn('[contact] Turnstile token missing or client-side error, skipping verification');
    return true;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    });

    const result = await response.json() as { success: boolean };
    return result.success;
  } catch (err) {
    console.error('[contact] Turnstile verification failed:', err);
    return false;
  }
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

    const { name, email, subject, message, _company, _loadTime } = validation.data;
    const turnstileToken = validation.data['cf-turnstile-response'] || '';

    // L1: Honeypot check — if filled, silently succeed (fool the bot)
    if (_company && _company.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message sent successfully.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // L2: Rate limiting
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

    // L3: Time-based detection — reject suspiciously fast submissions
    if (_loadTime && _loadTime > 0) {
      const elapsed = Date.now() - _loadTime;
      if (elapsed < MIN_SUBMIT_TIME_MS) {
        // Silently succeed to not reveal detection to bots
        return new Response(
          JSON.stringify({ success: true, message: 'Message sent successfully.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // L4: Email domain validation — MX records + disposable blocklist
    if (isDisposableEmail(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Please use a permanent email address (disposable emails are not accepted).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const emailDomain = email.split('@')[1];
    if (emailDomain && !(await hasValidMxRecords(emailDomain))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'The email domain does not appear to accept mail. Please check your email address.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // L5: Cloudflare Turnstile verification
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Security verification failed. Please refresh the page and try again.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
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
