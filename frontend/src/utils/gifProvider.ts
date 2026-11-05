export interface GifResult {
  id: string;
  /** What the chat stores and shows; its host must be on the API's GIF_ALLOWED_HOSTS. */
  url: string;
  previewUrl: string;
  title: string;
}

/** A GIF search service. Add another provider here without touching the chat UI. */
export interface GifProvider {
  /** Shown as "Powered by <name>" in the picker, as the providers' terms ask. */
  name: string;
  /** Trending GIFs when `query` is blank. */
  search: (query: string, signal?: AbortSignal) => Promise<GifResult[]>;
}

interface GiphyImage {
  url?: string;
}

interface GiphyGif {
  id: string;
  title?: string;
  images?: { fixed_height?: GiphyImage; fixed_height_small?: GiphyImage; downsized?: GiphyImage };
}

const GIPHY_LIMIT = 24;

export const giphyProvider = (apiKey: string): GifProvider => ({
  name: "GIPHY",
  search: async (query, signal) => {
    const term = query.trim();
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(GIPHY_LIMIT),
      rating: "pg-13",
    });
    if (term) params.set("q", term);
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/${term ? "search" : "trending"}?${params}`,
      { signal },
    );
    if (!response.ok) throw new Error(`GIPHY answered ${response.status}`);
    const { data } = (await response.json()) as { data: GiphyGif[] };
    return data.flatMap((gif) => {
      const url = gif.images?.fixed_height?.url ?? gif.images?.downsized?.url;
      const previewUrl = gif.images?.fixed_height_small?.url ?? url;
      return url && previewUrl ? [{ id: gif.id, url, previewUrl, title: gif.title ?? "GIF" }] : [];
    });
  },
});

/** The configured provider, or null when the build has no key (the GIF button then stays hidden). */
export const gifProvider = (): GifProvider | null => {
  const key = import.meta.env.VITE_GIPHY_API_KEY;
  return key ? giphyProvider(key) : null;
};
