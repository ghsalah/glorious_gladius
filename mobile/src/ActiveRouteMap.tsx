/**
 * Default module for TypeScript only. Metro prefers platform files:
 * - `ActiveRouteMap.web.tsx` on web
 * - `ActiveRouteMap.native.tsx` on iOS/Android
 */
export { ActiveRouteMap, type MapCoord } from './ActiveRouteMap.native';
