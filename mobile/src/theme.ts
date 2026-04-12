/**
 * Matches admin app: `AdminShell` (slate-50 / white / slate borders) + emerald-600 actions.
 * Brand title color `#1B3022`. Status/map hues match `admin/src/lib/deliveryStatusStyle.ts`.
 */
export const THEME = {
  background: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  textMain: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  /** Primary — emerald-600 */
  primary: '#059669',
  primaryDark: '#047857',
  /** Links / secondary emphasis — emerald-700 */
  link: '#047857',
  accent: '#047857',
  /** Sidebar brand — AdminShell */
  brand: '#1B3022',
  onPrimary: '#ffffff',
  success: '#059669',
  error: '#b91c1c',
  radiusLg: 16,
  radiusMd: 12,
  radiusSm: 8,
  status: {
    pending: '#64748b',
    accepted: '#2563eb',
    in_progress: '#d97706',
    completed: '#059669',
  } as const,
  statusBg: {
    pending: '#f1f5f9',
    accepted: '#eff6ff',
    in_progress: '#fffbeb',
    completed: '#ecfdf5',
  } as const,
  map: {
    warehouse: '#7c3aed',
    driver: '#2563eb',
    destination: '#d97706',
    routeLine: '#059669',
  },
  shadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;
