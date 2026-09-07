"use client";

import { useState, type SubmitEvent } from "react";
import { Menu, X } from "lucide-react";
import { toast } from "react-toastify";
import PlaceMap, { type MapPlace } from "./PlaceMap";
import ThemeToggle from "./ThemeToggle";
import { formatOpeningHours } from "@/lib/format";

// search_text is one continuous sentence (built for embeddings, not display) —
// break "Hours: ..." and "Located at ..." onto their own lines for readability,
// and convert the embedded hours to 12-hour time.
function formatSearchTextLines(text: string): string[] {
  return text
    .split(/(?=\bHours:|\bLocated at\b)/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("Hours:") ? formatOpeningHours(line) : line));
}

interface PlaceResult extends MapPlace {
  similarity: number;
}

interface AskParams {
  semanticQuery: string;
  category: string | null;
  near: string | null;
  radiusMeters: number | null;
}

interface AskResponse {
  query: string;
  params: AskParams;
  category: string | null;
  near: string | null;
  radiusMeters: number | null;
  results: PlaceResult[];
  error?: string;
}

export default function SearchApp() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [hasError, setHasError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setHasError(false);

    try {
      const res = await fetch(`/api/ask?q=${encodeURIComponent(trimmed)}`);
      const data: AskResponse = await res.json();

      if (res.ok) {
        setResponse(data);
      } else {
        setHasError(true);
        toast.error(data.error ?? "Something went wrong");
      }
    } catch {
      setHasError(true);
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const results = response?.results ?? [];

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <PlaceMap places={results} sidebarOpen={!collapsed} />
      </div>

      <div
        className={`themed-scroll absolute top-0 left-0 z-10 flex h-full w-96 flex-col overflow-y-auto border-r border-panel-border bg-panel shadow-lg transition-transform duration-300 ease-in-out ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <header className="px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">Omaha Place Finder</h1>
            <ThemeToggle />
          </div>
          <p className="mt-2 text-sm text-muted">
            Natural-language place search for Omaha, NE — PostGIS for geography, pgvector for semantics, an LLM to
            tie them together, capped at 20 results per search and rate-limited to prevent abuse.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-panel-border px-6 py-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. good food around Dundee"
            className="flex-1 rounded-md border border-panel-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:focus:shadow-[0_0_12px_var(--color-ring)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50 dark:shadow-[0_0_14px_rgba(187,154,247,0.35)] dark:hover:shadow-[0_0_20px_rgba(187,154,247,0.55)]"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        <div className="flex-1 border-t border-panel-border">
          {results.length === 0 ? (
            <div className="p-6 text-sm text-muted">
              {loading ? (
                "Searching…"
              ) : hasError ? null : response ? (
                <>
                  <p>No places matched &ldquo;{response.query}&rdquo;.</p>
                  <p className="mt-2">
                    Try something more specific, like &ldquo;coffee shop downtown&rdquo; or &ldquo;park near
                    Dundee&rdquo;.
                  </p>
                </>
              ) : (
                "No results yet — try a search above."
              )}
            </div>
          ) : (
            <ul>
              {results.map((place) => (
                <li key={place.id} className="border-b border-panel-border p-4">
                  <div className="font-medium">{place.name ?? "Unnamed place"}</div>
                  {place.category && <span className="text-xs uppercase tracking-wide text-muted">{place.category}</span>}
                  {place.search_text && (
                    <div className="mt-1 text-sm text-muted">
                      {formatSearchTextLines(place.search_text).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`absolute top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-panel-border bg-panel text-muted shadow transition-[left] duration-300 ease-in-out hover:text-foreground dark:hover:shadow-[0_0_10px_var(--color-ring)] ${
          collapsed ? "left-4" : "left-100"
        }`}
      >
        {collapsed ? <Menu size={22} strokeWidth={2.75} /> : <X size={22} strokeWidth={2.75} />}
      </button>
    </div>
  );
}
