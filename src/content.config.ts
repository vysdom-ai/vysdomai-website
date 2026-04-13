import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ============================================
// Blog Collection
// Standard articles, thought leadership, commentary
// ============================================
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Vysdom AI'),
    tags: z.array(z.string()).default([]),
    ogImage: z.string().optional(),
    canonical: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

// ============================================
// Research Collection
// Academic papers, preprints, formal publications
// ============================================
const research = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    abstract: z.string(),
    domain: z.enum(['physics', 'economics']),
    doi: z.string().optional(),
    venue: z.string().optional(),
    date: z.coerce.date(),
    authors: z.array(z.string()),
    pdfUrl: z.string().url().optional(),
    arxivUrl: z.string().url().optional(),
    ssrnUrl: z.string().url().optional(),
    zenodoUrl: z.string().url().optional(),
    status: z.enum(['preprint', 'submitted', 'under-review', 'published']).default('preprint'),
    tags: z.array(z.string()).default([]),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// ============================================
// Campaigns Collection
// Marketing campaigns and landing page content
// ============================================
const campaigns = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/campaigns' }),
  schema: z.object({
    name: z.string(),
    slug: z.string().optional(),
    status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
    launchDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    description: z.string(),
    heroImage: z.string().optional(),
    ogImage: z.string().optional(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

// ============================================
// Case Studies Collection
// Client success stories (requires client approval)
// ============================================
const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    approved: z.boolean().default(false),
    serviceType: z.enum([
      'research-consulting',
      'data-analysis',
      'model-development',
      'technical-review',
      'other',
    ]),
    industry: z.string().optional(),
    date: z.coerce.date(),
    testimonial: z.string().optional(),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
  research,
  campaigns,
  'case-studies': caseStudies,
};
