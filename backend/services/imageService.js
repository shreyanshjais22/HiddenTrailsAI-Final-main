/**
 * Image Service
 * ---------------
 * Fetches destination images from Wikipedia API (free, no API key needed).
 * Uses smart keyword extraction to find unique images for each landmark.
 */

import fetch from "node-fetch";

// Fallback image when no destination-specific image is found
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=400&fit=crop";

// Common fluff words to strip from queries
const STRIP_WORDS = /\b(travel|photography|day|morning|afternoon|evening|vibes|trip|explore|visit|arrival|departure|and|the|in|at|of|to|a|an|with|for|from)\b/gi;

/**
 * Get a relevant image for a destination/query using Wikipedia's API.
 * Uses multiple search strategies to find a unique image per landmark.
 *
 * @param {string} query - Search query (e.g., "Goa Fort Aguada travel photography")
 * @returns {Promise<string>} Image URL
 */
export async function getDestinationImage(query) {
  try {
    // Extract meaningful keywords from the query
    const searchStrategies = buildSearchStrategies(query);

    console.log("🖼️ Image search strategies:", searchStrategies);

    // Try each strategy in order until we find a unique image
    for (const term of searchStrategies) {
      if (!term || term.length < 2) continue;
      const image = await fetchWikipediaImage(term);
      if (image) return image;
    }

    // Final fallback
    console.log("⚠️ No Wikipedia image found for:", query);
    return FALLBACK_IMAGE;
  } catch (error) {
    console.error("Image fetch error:", error.message);
    return FALLBACK_IMAGE;
  }
}

/**
 * Build a list of search strategies from a query.
 * Prioritizes specific landmark names over generic destination names.
 *
 * E.g., "Goa Fort Aguada travel photography" =>
 *   ["Fort Aguada Goa", "Fort Aguada", "Goa"]
 *
 * @param {string} query
 * @returns {string[]} Array of search terms to try, most specific first
 */
function buildSearchStrategies(query) {
  // Step 1: Strip fluff words
  const cleaned = query.replace(STRIP_WORDS, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(w => w.length > 1);

  if (words.length === 0) return [query.split(" ")[0]];
  if (words.length === 1) return [words[0]];

  // Step 2: Identify the destination (usually first word) vs landmark (remaining)
  const destination = words[0]; // e.g., "Goa"
  const landmarkWords = words.slice(1); // e.g., ["Fort", "Aguada"]

  const strategies = [];

  // Strategy 1: Full landmark name + destination (most specific)
  if (landmarkWords.length > 0) {
    strategies.push(landmarkWords.join(" ") + " " + destination);
  }

  // Strategy 2: Just landmark name (e.g., "Fort Aguada")
  if (landmarkWords.length > 0) {
    strategies.push(landmarkWords.join(" "));
  }

  // Strategy 3: First 3 meaningful words together
  if (words.length >= 3) {
    strategies.push(words.slice(0, 3).join(" "));
  }

  // Strategy 4: Just destination name (generic fallback)
  strategies.push(destination);

  // Deduplicate
  return [...new Set(strategies)];
}

/**
 * Fetch a page thumbnail from Wikipedia's API.
 * Uses opensearch to find the best matching page first,
 * then fetches its thumbnail.
 *
 * @param {string} searchTerm - Search term (e.g., "Fort Aguada")
 * @returns {Promise<string|null>} Image URL or null if not found
 */
async function fetchWikipediaImage(searchTerm) {
  try {
    // Step 1: Search Wikipedia for the best matching page
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      searchTerm
    )}&limit=3&format=json`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const titles = searchData[1]; // Array of matching page titles

    if (!titles || titles.length === 0) {
      // Fallback to direct title search
      return await fetchPageImage(searchTerm);
    }

    // Step 2: Try each matching page until we find one with an image
    for (const title of titles) {
      const image = await fetchPageImage(title);
      if (image) return image;
    }

    return null;
  } catch (err) {
    console.warn("Wikipedia search error:", err.message);
    return null;
  }
}

/**
 * Fetch the thumbnail image from a specific Wikipedia page.
 *
 * @param {string} title - Exact Wikipedia page title
 * @returns {Promise<string|null>} Image URL or null
 */
async function fetchPageImage(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=pageimages&format=json&pithumbsize=800&redirects=1`;

  const response = await fetch(url);
  const data = await response.json();
  const pages = data.query?.pages;

  if (pages) {
    const page = Object.values(pages)[0];
    if (page.thumbnail?.source) {
      console.log("✅ Wikipedia image found for:", title);
      return page.thumbnail.source;
    }
  }

  return null;
}
