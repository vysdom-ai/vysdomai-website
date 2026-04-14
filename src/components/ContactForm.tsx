import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';

/**
 * ContactForm — React island for the contact page.
 *
 * Features:
 *  - Client-side validation (required fields, email format)
 *  - Honeypot spam protection (_company hidden field)
 *  - Time-based bot detection (_loadTime timestamp)
 *  - Cloudflare Turnstile invisible CAPTCHA
 *  - Multi-state UI: idle → loading → success / error
 *  - Submits to /api/contact server endpoint
 */

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  _company: string; // honeypot
}

type FormState = 'idle' | 'loading' | 'success' | 'error';

const SUBJECT_OPTIONS = [
  { value: '', label: 'Select a subject…' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'research', label: 'Research Collaboration' },
  { value: 'advisory', label: 'Technical Advisory' },
  { value: 'speaking', label: 'Speaking Engagement' },
  { value: 'other', label: 'Other' },
] as const;

const initialFormData: FormData = {
  name: '',
  email: '',
  subject: '',
  message: '',
  _company: '',
};

// ── Shared styles (uses CSS custom properties from global.css) ──

const inputBaseStyles: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text-primary)',
  backgroundColor: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-lg)',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const inputFocusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.borderColor = 'var(--color-brand-500)';
  e.target.style.boxShadow = '0 0 0 3px rgba(70, 30, 150, 0.1)';
};

const inputBlurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.borderColor = 'var(--color-border-default)';
  e.target.style.boxShadow = 'none';
};

const labelStyles: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.375rem',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text-primary)',
};

const errorTextStyles: React.CSSProperties = {
  marginTop: '0.25rem',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-error)',
  fontFamily: 'var(--font-body)',
};

interface Props {
  /** Pre-fill subject from URL query param */
  defaultSubject?: string;
  /** Cloudflare Turnstile site key */
  turnstileSiteKey?: string;
}

export default function ContactForm({ defaultSubject = '', turnstileSiteKey = '' }: Props) {
  const [formData, setFormData] = useState<FormData>({
    ...initialFormData,
    subject: defaultSubject,
  });
  const [formState, setFormState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [serverMessage, setServerMessage] = useState('');
  const [loadTime] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);

  // ── Load Turnstile widget ──

  useEffect(() => {
    if (!turnstileSiteKey) return;

    // Load Turnstile script if not already loaded
    const scriptId = 'cf-turnstile-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => renderTurnstile();
      document.head.appendChild(script);
    } else if ((window as any).turnstile) {
      renderTurnstile();
    }

    function renderTurnstile() {
      const turnstile = (window as any).turnstile;
      if (turnstile && turnstileRef.current && !turnstileRef.current.hasChildNodes()) {
        turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => {
            // Turnstile failed client-side (e.g., localhost not whitelisted,
            // ad blocker, network issue). Degrade gracefully — form remains
            // submittable using other 4 security layers.
            console.warn('[ContactForm] Turnstile client-side verification failed, degrading gracefully');
            setTurnstileToken('__cf_turnstile_error__');
          },
          theme: 'auto',
          size: 'flexible',
        });
      }
    }
  }, [turnstileSiteKey]);

  // ── Validation ──

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required.';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be under 100 characters.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.subject) {
      newErrors.subject = 'Please select a subject.';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required.';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters.';
    } else if (formData.message.trim().length > 5000) {
      newErrors.message = 'Message must be under 5,000 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Change handler ──

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name as keyof FormData]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof FormData];
        return next;
      });
    }
  }

  // ── Submit handler ──

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setFormState('loading');
    setServerMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          _loadTime: loadTime,
          'cf-turnstile-response': turnstileToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFormState('success');
        setServerMessage(data.message || 'Message sent successfully.');
      } else {
        setFormState('error');
        setServerMessage(data.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setFormState('error');
      setServerMessage('Network error. Please check your connection and try again.');
    }
  }

  // ── Success state ──

  if (formState === 'success') {
    return (
      <div
        style={{
          padding: '2.5rem 2rem',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div
          style={{
            fontSize: '2.5rem',
            marginBottom: '1rem',
          }}
          aria-hidden="true"
        >
          ✓
        </div>
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-xl)',
            marginBottom: '0.5rem',
            color: 'var(--color-text-primary)',
          }}
        >
          Message Sent
        </h3>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: '1.5rem',
            maxWidth: '360px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.6',
          }}
        >
          Thank you for reaching out. I typically respond within 48 business hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setFormData(initialFormData);
            setFormState('idle');
            setErrors({});
            setServerMessage('');
            setTurnstileToken('');
            // Reset Turnstile widget
            if ((window as any).turnstile) {
              (window as any).turnstile.reset();
            }
          }}
          style={{
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            color: 'var(--color-text-link)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  // ── Form state ──

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Name */}
        <div>
          <label htmlFor="contact-name" style={labelStyles}>
            Name <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="text"
            id="contact-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
            placeholder="Your full name"
            autoComplete="name"
            required
            style={{
              ...inputBaseStyles,
              ...(errors.name ? { borderColor: 'var(--color-error)' } : {}),
            }}
          />
          {errors.name && <p style={errorTextStyles}>{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="contact-email" style={labelStyles}>
            Email <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <input
            type="email"
            id="contact-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onFocus={inputFocusHandler}
            onBlur={inputBlurHandler}
            placeholder="you@example.com"
            autoComplete="email"
            required
            style={{
              ...inputBaseStyles,
              ...(errors.email ? { borderColor: 'var(--color-error)' } : {}),
            }}
          />
          {errors.email && <p style={errorTextStyles}>{errors.email}</p>}
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="contact-subject" style={labelStyles}>
            Subject <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <select
            id="contact-subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            onFocus={inputFocusHandler as any}
            onBlur={inputBlurHandler as any}
            required
            style={{
              ...inputBaseStyles,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              paddingRight: '2.5rem',
              ...(errors.subject ? { borderColor: 'var(--color-error)' } : {}),
            }}
          >
            {SUBJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.subject && <p style={errorTextStyles}>{errors.subject}</p>}
        </div>

        {/* Message */}
        <div>
          <label htmlFor="contact-message" style={labelStyles}>
            Message <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            onFocus={inputFocusHandler as any}
            onBlur={inputBlurHandler as any}
            placeholder="Tell me about your project or inquiry…"
            rows={5}
            required
            style={{
              ...inputBaseStyles,
              resize: 'vertical',
              minHeight: '120px',
              ...(errors.message ? { borderColor: 'var(--color-error)' } : {}),
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.25rem',
            }}
          >
            {errors.message ? (
              <p style={errorTextStyles}>{errors.message}</p>
            ) : (
              <span />
            )}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {formData.message.length}/5,000
            </span>
          </div>
        </div>

        {/* Honeypot — hidden from humans, visible to bots */}
        <div
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            opacity: 0,
            height: 0,
            overflow: 'hidden',
          }}
          aria-hidden="true"
          tabIndex={-1}
        >
          <label htmlFor="contact-company">Company</label>
          <input
            type="text"
            id="contact-company"
            name="_company"
            value={formData._company}
            onChange={handleChange}
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        {/* Cloudflare Turnstile widget (invisible) */}
        {turnstileSiteKey && (
          <div ref={turnstileRef} style={{ marginTop: '-0.5rem' }} />
        )}

        {/* Error message from server */}
        {formState === 'error' && serverMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-error)',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {serverMessage}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={formState === 'loading'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.875rem 1.5rem',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: 'var(--color-brand-500)',
            border: 'none',
            borderRadius: '9999px',
            cursor: formState === 'loading' ? 'wait' : 'pointer',
            opacity: formState === 'loading' ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (formState !== 'loading') {
              e.currentTarget.style.backgroundColor = 'var(--color-brand-600)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-brand-500)';
          }}
        >
          {formState === 'loading' ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
              </svg>
              Sending…
            </>
          ) : (
            'Send Message'
          )}
        </button>
      </div>

      {/* Inline keyframe for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}
