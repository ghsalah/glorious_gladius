/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Django API base URL (no trailing slash) */
  readonly VITE_API_URL: string
  /** Google Maps JavaScript API key (Maps + Directions/Distance Matrix billing) */
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  /** Optional Map ID for vector maps / AdvancedMarker (Google Cloud Console). */
  readonly VITE_GOOGLE_MAPS_MAP_ID: string
  /**
   * Set to `"true"` to draw routes along roads (Directions API + billing). If unset, routes are
   * straight geodesic segments between stops (reliable, no extra API).
   */
  readonly VITE_USE_ROAD_DIRECTIONS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
