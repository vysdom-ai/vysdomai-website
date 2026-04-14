import { test, expect } from '@playwright/test';

/**
 * Link Validation Tests — Layer 8
 * Validates all navigation and footer links resolve correctly.
 */

test.describe('Navigation links', () => {
  test('all nav links should be valid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const navLinks = page.locator('nav a[href^="/"]');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status(), `Nav link ${href} should resolve`).toBeLessThan(400);
      }
    }
  });
});

test.describe('Footer links', () => {
  test('all internal footer links should be valid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await footerLinks.nth(i).getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status(), `Footer link ${href} should resolve`).toBeLessThan(400);
      }
    }
  });

  test('external links should have correct attributes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const externalLinks = page.locator('footer a[href^="http"]');
    const count = await externalLinks.count();

    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      const rel = await link.getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });
});
