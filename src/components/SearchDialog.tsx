/**
 * SearchDialog — Command palette search (React island).
 *
 * Uses cmdk for the modal UI and Pagefind for static search.
 * Triggered by ⌘K / Ctrl+K keyboard shortcut or search button click.
 * Loaded via `client:load` in Navigation.astro.
 *
 * cmdk Command.Dialog wraps Radix Dialog, providing:
 *   - Portal (renders outside DOM tree)
 *   - Overlay (backdrop, styled via [cmdk-overlay])
 *   - Content container (styled via [cmdk-dialog])
 *   - Focus trapping + Escape to close
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Command } from 'cmdk';

// Pagefind types (loaded dynamically at runtime from /pagefind/pagefind.js)
interface PagefindResultData {
  url: string;
  meta: { title?: string; image?: string };
  excerpt: string;
  content: string;
}

interface PagefindInstance {
  init: () => Promise<void>;
  search: (query: string) => Promise<{
    results: Array<{ id: string; data: () => Promise<PagefindResultData> }>;
  }>;
  destroy: () => void;
}

interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const pagefindRef = useRef<PagefindInstance | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize Pagefind lazily on first open.
  // NOTE: Pagefind JS is generated post-build at /pagefind/pagefind.js.
  // Using new Function() to create a dynamic import that Vite cannot statically analyze.
  // This is the standard Pagefind-in-frameworks pattern.
  const initPagefind = useCallback(async () => {
    if (pagefindRef.current) return;

    try {
      // new Function bypasses Vite/Rollup static analysis of import()
      const dynamicImport = new Function('return import("/pagefind/pagefind.js")');
      const pf = await dynamicImport();
      await pf.init();
      pagefindRef.current = pf;
    } catch {
      // Pagefind not available (dev mode or build not run yet)
      console.warn(
        'Pagefind not available — search requires a production build.'
      );
    }
  }, []);

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Pagefind when dialog opens
  useEffect(() => {
    if (open) {
      initPagefind();
    }
  }, [open, initPagefind]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!pagefindRef.current) return;

      setLoading(true);
      try {
        const search = await pagefindRef.current.search(query);
        const data = await Promise.all(
          search.results.slice(0, 8).map((r) => r.data())
        );

        setResults(
          data.map((d) => ({
            url: d.url,
            title: d.meta?.title || 'Untitled',
            excerpt: d.excerpt,
          }))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Navigate to result
  const handleSelect = (url: string) => {
    setOpen(false);
    window.location.href = url;
  };

  return (
    <>
      {/* Search trigger button — visible on all viewports (Apple mobile pattern) */}
      <button
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Search (⌘K)"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg
                   text-text-secondary transition-colors duration-200
                   hover:bg-surface-tertiary hover:text-text-primary
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-brand-500 cursor-pointer"
        id="search-trigger"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      {/* Command palette dialog — rendered via Radix Portal (outside DOM tree) */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search Vysdom AI"
        shouldFilter={false}
      >
        {/* Input row */}
        <div className="search-input-wrapper">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="search-input-icon"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <Command.Input
            placeholder="Search Vysdom AI..."
            value={query}
            onValueChange={setQuery}
            className="search-input"
          />

          <kbd className="search-kbd">ESC</kbd>
        </div>

        {/* Results */}
        <Command.List className="search-results">
          {loading && (
            <Command.Loading className="search-loading">
              Searching…
            </Command.Loading>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <Command.Empty className="search-empty">
              No results for &ldquo;{query}&rdquo;
            </Command.Empty>
          )}

          {!loading && !query.trim() && (
            <div className="search-hint">
              <p>Type to search across all pages and research.</p>
              <div className="search-hint-shortcuts">
                <span><kbd>↑↓</kbd> Navigate</span>
                <span><kbd>↵</kbd> Open</span>
                <span><kbd>ESC</kbd> Close</span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <Command.Group heading="Results" className="search-group">
              {results.map((result) => (
                <Command.Item
                  key={result.url}
                  value={result.url}
                  onSelect={() => handleSelect(result.url)}
                  className="search-item"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="search-item-icon"
                    aria-hidden="true"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 9H8" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                  </svg>
                  <div className="search-item-content">
                    <span className="search-item-title">{result.title}</span>
                    <span
                      className="search-item-excerpt"
                      dangerouslySetInnerHTML={{ __html: result.excerpt }}
                    />
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="search-item-arrow"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer */}
        <div className="search-footer">
          <span className="search-footer-brand">
            Search by <strong>Pagefind</strong>
          </span>
          <span className="search-footer-shortcut">
            <kbd>⌘</kbd><kbd>K</kbd>
          </span>
        </div>
      </Command.Dialog>
    </>
  );
}
