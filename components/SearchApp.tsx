"use client";

import { useState, type SubmitEvent } from "react";
import { Menu, X } from "lucide-react";
import { toast } from "react-toastify";
import PlaceMap, { type MapPlace } from "./PlaceMap";

interface PlaceResult extends MapPlace {
  category: string | null;
  search_text: string | null;
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
  const [collapsed, setCollapsed] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/ask?q=${encodeURIComponent(trimmed)}`);
      const data: AskResponse = await res.json();

      setResponse(data);
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const results = response?.results ?? [];

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <PlaceMap places={results} />
      </div>

      <div
        className={`absolute top-0 left-0 z-10 flex h-full w-96 flex-col overflow-y-auto border-r border-zinc-200 bg-white shadow-lg transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <header className="px-6 py-4">
          <h1 className="text-xl font-semibold">Omaha Place Finder</h1>
          <p className="text-sm text-zinc-500">
            Natural-language search over Omaha, NE — PostGIS for geography, pgvector for semantics, an LLM to tie
            them together.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. somewhere chill to grab coffee near Memorial Park"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {response?.params && (
          <div className="border-t border-zinc-200 px-6 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            Interpreted as: <code>{JSON.stringify(response.params)}</code>
          </div>
        )}

        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800">
          {results.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              {loading ? "Searching…" : "No results yet — try a search above."}
            </p>
          ) : (
            <ul>
              {results.map((place) => (
                <li key={place.id} className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{place.name ?? "Unnamed place"}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{(place.similarity * 100).toFixed(0)}%</span>
                  </div>
                  {place.category && (
                    <span className="text-xs uppercase tracking-wide text-zinc-500">{place.category}</span>
                  )}
                  {place.search_text && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{place.search_text}</p>
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
        className={`absolute top-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow transition-[left] duration-300 ease-in-out hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 ${
          collapsed ? "left-4" : "left-100"
        }`}
      >
        {collapsed ? <Menu size={22} strokeWidth={2.75} /> : <X size={22} strokeWidth={2.75} />}
      </button>
    </div>
  );
}
