/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require('./app.json');

/**
 * Dynamic Expo config: keeps `app.json` as the source of truth and adds
 * Android versionCode. EAS reads `extra.eas.projectId` from here or from
 * `app.json` after you run `npm run eas:init` once (Expo links the project).
 */
module.exports = () => {
  const { expo } = appJson;
  const rawId = expo.extra?.eas?.projectId || process.env.EAS_PROJECT_ID;
  const projectId = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : undefined;
  const eas = {
    ...(expo.extra?.eas || {}),
    ...(projectId ? { projectId } : {}),
  };

  const googleMapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY?.trim() ||
    '';

  const plugins = [...(expo.plugins || [])];
  plugins.push([
    'expo-location',
    {
      locationWhenInUsePermission:
        'Glorious Gladius uses your location for the live route map and to share your position with dispatch during active deliveries.',
    },
  ]);
  if (googleMapsKey) {
    plugins.push([
      'react-native-maps',
      {
        iosGoogleMapsApiKey: googleMapsKey,
        androidGoogleMapsApiKey: googleMapsKey,
      },
    ]);
  }

  return {
    ...expo,
    plugins,
    android: {
      ...expo.android,
      versionCode: expo.android?.versionCode ?? 1,
      config: {
        ...(expo.android?.config || {}),
        ...(googleMapsKey
          ? {
              googleMaps: {
                apiKey: googleMapsKey,
              },
            }
          : {}),
      },
    },
    extra: {
      ...(expo.extra || {}),
      ...(Object.keys(eas).length ? { eas } : {}),
    },
  };
};
