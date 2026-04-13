import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ResearchFilter — React island for client-side domain filtering.
 *
 * Receives serialized research entries as props from Astro,
 * renders filter tabs + filtered card grid with Framer Motion transitions.
 */

interface ResearchEntry {
  id: string;
  title: string;
  abstract: string;
  domain: string;
  date: string;
  status: string;
  authors: string[];
  tags: string[];
  pdfUrl?: string;
  arxivUrl?: string;
  ssrnUrl?: string;
  zenodoUrl?: string;
}

interface Props {
  entries: ResearchEntry[];
}

const domainLabels: Record<string, string> = {
  all: 'All',
  physics: 'Physics',
  economics: 'Economics',
};

const domainBadgeColors: Record<string, string> = {
  physics: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  economics: 'bg-surface-tertiary text-text-secondary',
};

const statusLabels: Record<string, string> = {
  preprint: 'Preprint',
  submitted: 'Submitted',
  'under-review': 'Under Review',
  published: 'Published',
};

export default function ResearchFilter({ entries }: Props) {
  const [activeDomain, setActiveDomain] = useState('all');

  const filteredEntries =
    activeDomain === 'all'
      ? entries
      : entries.filter((e) => e.domain === activeDomain);

  // Get unique domains from actual entries
  const domains = ['all', ...new Set(entries.map((e) => e.domain))];

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter by domain">
        {domains.map((domain) => (
          <button
            key={domain}
            role="tab"
            aria-selected={activeDomain === domain}
            onClick={() => setActiveDomain(domain)}
            className={`
              rounded-full px-5 py-2 text-sm font-medium font-body
              transition-all duration-200 cursor-pointer
              ${
                activeDomain === domain
                  ? 'bg-brand-500 shadow-md'
                  : 'border border-border-default bg-transparent text-text-secondary hover:bg-surface-tertiary hover:border-border-strong'
              }
            `}
            style={activeDomain === domain ? { color: '#ffffff' } : undefined}
          >
            {domainLabels[domain] || domain}
            <span className="ml-1.5 text-xs opacity-70">
              ({domain === 'all' ? entries.length : entries.filter((e) => e.domain === domain).length})
            </span>
          </button>
        ))}
      </div>

      {/* Research cards grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filteredEntries.map((entry) => (
            <motion.article
              key={entry.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="block bg-surface-elevated border border-border-subtle rounded-xl
                         shadow-card p-6 md:p-8 transition-all duration-200
                         hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              {/* Header: badges */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium font-body rounded-full ${
                    domainBadgeColors[entry.domain] || 'bg-surface-tertiary text-text-secondary'
                  }`}
                >
                  {domainLabels[entry.domain] || entry.domain}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium font-body rounded-full border border-border-default text-text-secondary bg-transparent">
                  {new Date(entry.date).getFullYear()}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium font-body rounded-full border border-border-default text-text-secondary bg-transparent">
                  {statusLabels[entry.status] || entry.status}
                </span>
              </div>

              {/* Title */}
              <h3 className="mb-3 font-heading text-xl leading-snug text-text-primary">
                {entry.title}
              </h3>

              {/* Authors & date */}
              <p className="mb-3 text-xs text-text-tertiary font-body">
                {entry.authors.join(', ')} · {new Date(entry.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                })}
              </p>

              {/* Abstract preview */}
              <p
                className="mb-5 text-sm text-text-secondary leading-relaxed"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {entry.abstract}
              </p>

              {/* External links */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/research/${entry.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                             text-xs font-semibold font-body no-underline cursor-pointer
                             border border-border-default bg-transparent text-text-primary
                             hover:bg-surface-tertiary hover:border-border-strong
                             transition-all duration-200"
                >
                  Read More →
                </a>
                {entry.pdfUrl && (
                  <a
                    href={entry.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                               text-xs font-semibold font-body no-underline cursor-pointer
                               border border-border-default bg-transparent text-text-secondary
                               hover:bg-surface-tertiary hover:border-border-strong
                               transition-all duration-200"
                  >
                    PDF ↗
                  </a>
                )}
                {entry.arxivUrl && (
                  <a
                    href={entry.arxivUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                               text-xs font-semibold font-body no-underline cursor-pointer
                               border border-border-default bg-transparent text-text-secondary
                               hover:bg-surface-tertiary hover:border-border-strong
                               transition-all duration-200"
                  >
                    arXiv ↗
                  </a>
                )}
                {entry.ssrnUrl && (
                  <a
                    href={entry.ssrnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                               text-xs font-semibold font-body no-underline cursor-pointer
                               border border-border-default bg-transparent text-text-secondary
                               hover:bg-surface-tertiary hover:border-border-strong
                               transition-all duration-200"
                  >
                    SSRN ↗
                  </a>
                )}
                {entry.zenodoUrl && (
                  <a
                    href={entry.zenodoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5
                               text-xs font-semibold font-body no-underline cursor-pointer
                               border border-border-default bg-transparent text-text-secondary
                               hover:bg-surface-tertiary hover:border-border-strong
                               transition-all duration-200"
                  >
                    Zenodo ↗
                  </a>
                )}
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {filteredEntries.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-text-tertiary text-sm">
            No papers found in this domain yet.
          </p>
        </div>
      )}
    </div>
  );
}
