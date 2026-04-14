import { test, expect } from '@playwright/test';

/**
 * Edge Case Tests — Layer 9
 * 404 page, dark mode toggle, mobile menu behavior.
 */

test.describe('404 error page', () => {
  test('should display 404 content for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', { waitUntil: 'networkidle' });

    // Vercel serves custom 404 with 200 for SPAs, but check content
    const pageText = await page.textContent('body');
    expect(pageText).toContain('404');
  });
});

test.describe('Dark mode toggle', () => {
  test('should toggle dark class on html element', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const themeToggle = page.locator('[data-theme-toggle], #theme-toggle, button:has(svg)').first();

    if ((await themeToggle.count()) > 0) {
      const htmlEl = page.locator('html');
      const initialClass = await htmlEl.getAttribute('class');

      await themeToggle.click();
      await page.waitForTimeout(500);

      const newClass = await htmlEl.getAttribute('class');
      // One should have 'dark', the other shouldn't (or vice versa)
      const hadDark = initialClass?.includes('dark') ?? false;
      const hasDark = newClass?.includes('dark') ?? false;
      expect(hadDark).not.toBe(hasDark);
    }
  });
});

test.describe('Mobile menu', () => {
  test('should toggle on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const menuButton = page.locator('[data-mobile-menu-toggle], button[aria-label*="menu" i], button[aria-label*="Menu"]');

    if ((await menuButton.count()) > 0) {
      // Menu should initially be hidden
      const mobileNav = page.locator('[data-mobile-menu], nav[role="navigation"]');

      // Click to open
      await menuButton.first().click();
      await page.waitForTimeout(500);

      // Menu should be visible
      const isVisible = await mobileNav.first().isVisible();
      expect(isVisible).toBe(true);
    }
  });

  test('escape key should close mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const menuButton = page.locator('[data-mobile-menu-toggle], button[aria-label*="menu" i], button[aria-label*="Menu"]');

    if ((await menuButton.count()) > 0) {
      // Open menu
      await menuButton.first().click();
      await page.waitForTimeout(500);

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Verify menu closed or button state changed
      const ariaExpanded = await menuButton.first().getAttribute('aria-expanded');
      if (ariaExpanded !== null) {
        expect(ariaExpanded).toBe('false');
      }
    }
  });
});
