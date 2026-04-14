import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests — Layer 4
 * WCAG 2.2 AA compliance via axe-core on all pages.
 */

const pages = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Research', path: '/research' },
  { name: 'Dark GDP', path: '/research/dark-gdp' },
  { name: 'Services', path: '/services' },
  { name: 'Contact', path: '/contact' },
  { name: 'Privacy', path: '/privacy' },
  { name: 'Terms', path: '/terms' },
];

for (const page of pages) {
  test(`${page.name} should have no WCAG 2.2 AA violations`, async ({ page: p }) => {
    await p.goto(page.path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .exclude('.gsap-marker-scroller-start') // GSAP debug markers
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
