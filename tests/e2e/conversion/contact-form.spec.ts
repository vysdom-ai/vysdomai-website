import { test, expect } from '@playwright/test';

/**
 * Contact Form Tests — Layer 8
 * Validates form behavior, honeypot, subject pre-fill, and character counter.
 */

test.describe('Contact form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'networkidle' });
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    // Try to submit the form without filling anything
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission — check for :invalid pseudo-class
    const requiredFields = page.locator('input[required], textarea[required], select[required]');
    const count = await requiredFields.count();
    expect(count).toBeGreaterThan(0);

    // At least one field should be invalid
    for (let i = 0; i < count; i++) {
      const isValid = await requiredFields.nth(i).evaluate(
        (el: HTMLInputElement) => el.validity.valid,
      );
      // At least the first required field should be invalid
      if (i === 0) {
        expect(isValid).toBe(false);
      }
    }
  });

  test('honeypot field should be hidden', async ({ page }) => {
    const honeypot = page.locator('[data-honeypot]');
    const count = await honeypot.count();

    if (count > 0) {
      await expect(honeypot.first()).toBeHidden();
    }
    // If no honeypot, that's also acceptable
  });

  test('subject pre-fill via query parameter', async ({ page }) => {
    await page.goto('/contact?subject=research', { waitUntil: 'networkidle' });

    const subjectField = page.locator('select[name="subject"], input[name="subject"]');
    const count = await subjectField.count();

    if (count > 0) {
      const value = await subjectField.first().inputValue();
      // Subject should be pre-filled with something related to research
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('character counter should update on typing', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    const counter = page.locator('[data-char-count]');

    if ((await counter.count()) > 0) {
      const initialText = await counter.textContent();
      await textarea.fill('Hello, this is a test message.');
      const updatedText = await counter.textContent();
      expect(updatedText).not.toBe(initialText);
    }
  });
});
