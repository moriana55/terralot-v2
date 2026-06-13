"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

export default function FavoriteButton({ propertyId, size = "md" }: { propertyId: string; size?: "sm" | "md" }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(isFavorite(propertyId));
    const handler = () => setFav(isFavorite(propertyId));
    window.addEventListener("favorites-changed", handler);
    return () => window.removeEventListener("favorites-changed", handler);
  }, [propertyId]);

  const s = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(propertyId); }}
      className={`${s} rounded-lg flex items-center justify-center border transition-all`}
      style={{
        borderColor: fav ? "var(--error)" : "rgba(255,255,255,0.1)",
        background: fav ? "rgba(255,180,171,0.1)" : "transparent",
      }}
      title={fav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={iconSize} style={{ color: fav ? "var(--error)" : "var(--muted)", fill: fav ? "var(--error)" : "none" }} />
    </button>
  );
}
