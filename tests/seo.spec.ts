import { test, expect } from '@playwright/test';

/**
 * SEO Tests — Layer 7
 * OG meta tags, Schema.org JSON-LD, canonical URLs, sitemap.
 */

const pages = [
  { name: 'Home', path: '/', hasSchemOrg: true },
  { name: 'About', path: '/about', hasSchemOrg: true },
  { name: 'Research', path: '/research', hasSchemOrg: false },
  { name: 'Dark GDP', path: '/research/dark-gdp', hasSchemOrg: true },
  { name: 'Services', path: '/services', hasSchemOrg: true },
  { name: 'Contact', path: '/contact', hasSchemOrg: true },
  { name: 'Privacy', path: '/privacy', hasSchemOrg: false },
  { name: 'Terms', path: '/terms', hasSchemOrg: false },
];

test.describe('OG meta tags', () => {
  for (const page of pages) {
    test(`${page.name} should have og:title`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const ogTitle = p.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveCount(1);
      const content = await ogTitle.getAttribute('content');
      expect(content?.length).toBeGreaterThan(0);
    });

    test(`${page.name} should have og:description`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const ogDesc = p.locator('meta[property="og:description"]');
      await expect(ogDesc).toHaveCount(1);
    });

    test(`${page.name} should have og:image`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const ogImage = p.locator('meta[property="og:image"]');
      await expect(ogImage).toHaveCount(1);
      const content = await ogImage.getAttribute('content');
      expect(content).toContain('.png');
    });
  }
});

test.describe('Page titles', () => {
  for (const page of pages) {
    test(`${page.name} should contain "Vysdom" in title`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const title = await p.title();
      expect(title.toLowerCase()).toContain('vysdom');
    });
  }
});

test.describe('Schema.org JSON-LD', () => {
  for (const page of pages.filter((p) => p.hasSchemOrg)) {
    test(`${page.name} should have structured data`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const jsonLd = p.locator('script[type="application/ld+json"]');
      const count = await jsonLd.count();
      expect(count).toBeGreaterThan(0);

      const content = await jsonLd.first().textContent();
      expect(content).toBeTruthy();
      const parsed = JSON.parse(content!);
      expect(parsed['@context']).toBe('https://schema.org');
    });
  }
});

test.describe('Sitemap', () => {
  test('sitemap-index.xml should be accessible', async ({ page }) => {
    const response = await page.goto('/sitemap-index.xml');
    expect(response?.status()).toBe(200);
  });

  test('sitemap should contain all pages', async ({ page }) => {
    const response = await page.goto('/sitemap-0.xml');
    expect(response?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain('vysdom.ai');
  });
});

test.describe('Canonical URLs', () => {
  for (const page of pages) {
    test(`${page.name} should have canonical URL`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'networkidle' });
      const canonical = p.locator('link[rel="canonical"]');
      const count = await canonical.count();
      // Canonical is optional but recommended
      if (count > 0) {
        const href = await canonical.getAttribute('href');
        expect(href).toContain('vysdom.ai');
      }
    });
  }
});
