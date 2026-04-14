import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests — Layer 3
 * Captures full-page screenshots across all pages and viewports.
 * Run with --update-snapshots to generate initial baselines.
 */

const pages = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'research', path: '/research' },
  { name: 'research-dark-gdp', path: '/research/dark-gdp' },
  { name: 'services', path: '/services' },
  { name: 'contact', path: '/contact' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: '404', path: '/this-page-does-not-exist' },
];

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const page of pages) {
  for (const viewport of viewports) {
    test(`${page.name} @ ${viewport.name} (${viewport.width}px)`, async ({ page: p }) => {
      await p.setViewportSize({ width: viewport.width, height: viewport.height });
      await p.goto(page.path, { waitUntil: 'networkidle' });

      // Wait for any GSAP animations to complete
      await p.waitForTimeout(1500);

      await expect(p).toHaveScreenshot(`${page.name}-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
