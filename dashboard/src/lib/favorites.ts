const KEY = "terralot_favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function toggleFavorite(id: string): string[] {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem(KEY, JSON.stringify(favs));
  window.dispatchEvent(new Event("favorites-changed"));
  return favs;
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}
