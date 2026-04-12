import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8000;

type ExpoExtra = {
  apiBaseUrl?: string;
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Hostname of the machine running Metro (your PC on the LAN).
 * Metro may use a different port than the API; the app still talks to Django on API_PORT.
 */
function getDevMachineHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }

  const debuggerHost =
    // Expo Go (varies by SDK)
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (debuggerHost) {
    return debuggerHost.split(':')[0];
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return '127.0.0.1';
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) return stripTrailingSlash(envUrl);

  if (__DEV__) {
    const host = getDevMachineHost();
    return `http://${host}:${API_PORT}`;
  }

  const extraUrl = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.apiBaseUrl?.trim();
  if (extraUrl) return stripTrailingSlash(extraUrl);

  const host = getDevMachineHost();
  return `http://${host}:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = await AsyncStorage.getItem('driverToken');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorBody}`);
  }

  if (response.status !== 204) {
    return response.json();
  }
  return null;
};

/** Pull a server `message` from `API Error: status - {json}` for alerts. */
export function parseApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';
  const msg = error.message;
  const match = msg.match(/API Error: \d+ - ([\s\S]*)$/);
  if (match) {
    const body = match[1].trim();
    try {
      const j = JSON.parse(body) as { message?: string };
      if (typeof j.message === 'string' && j.message.length > 0) return j.message;
    } catch {
      if (body.length > 0) return body.slice(0, 300);
    }
  }
  return msg;
}
