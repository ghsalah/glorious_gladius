import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
  Switch,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { apiCall, parseApiErrorMessage } from './src/api';
import { ActiveRouteMap, type MapCoord } from './src/ActiveRouteMap';
import { THEME } from './src/theme';


function metersApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type DeliveryStatus = 'pending' | 'accepted' | 'in_progress' | 'completed';

type Delivery = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  status: DeliveryStatus;
  sequenceOrder: number | null;
  recipientName: string;
  recipientPhone: string;
  notes: string;
};

type Warehouse = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  updatedAt: string;
};

type DriverProfile = {
  name: string;
  email: string;
  vehicleLabel: string;
  onDuty: boolean;
};

/** API must use snake_case; this avoids a silent UI break if casing ever differs. */
function normalizeDeliveryStatus(raw: unknown): DeliveryStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (s === 'inprogress') return 'in_progress';
  if (s === 'pending' || s === 'accepted' || s === 'in_progress' || s === 'completed') {
    return s;
  }
  return 'pending';
}

function deliveryFromApiRow(raw: {
  id: string;
  address?: string;
  lat?: number;
  lng?: number;
  status?: unknown;
  sequenceOrder?: number | null;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string | null;
}): Delivery {
  return {
    id: raw.id,
    address: typeof raw.address === 'string' ? raw.address : '',
    lat: typeof raw.lat === 'number' ? raw.lat : 0,
    lng: typeof raw.lng === 'number' ? raw.lng : 0,
    status: normalizeDeliveryStatus(raw.status),
    sequenceOrder: raw.sequenceOrder ?? null,
    recipientName: typeof raw.recipientName === 'string' ? raw.recipientName : '',
    recipientPhone: typeof raw.recipientPhone === 'string' ? raw.recipientPhone : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}

function sortOpenRoute(deliveries: Delivery[]): Delivery[] {
  return [...deliveries].sort((a, b) => {
    const na = a.sequenceOrder == null;
    const nb = b.sequenceOrder == null;
    if (na !== nb) return na ? 1 : -1;
    const sa = a.sequenceOrder ?? 0;
    const sb = b.sequenceOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
}

function canStartThisStop(d: Delivery, open: Delivery[]): boolean {
  const otherActive = open.some((x) => x.status === 'in_progress' && x.id !== d.id);
  if (otherActive) return false;

  if (d.status === 'pending') {
    return open.length === 1;
  }
  if (d.status === 'accepted') {
    const first = sortOpenRoute(open)[0];
    return first?.id === d.id;
  }
  return false;
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      const storedToken = await AsyncStorage.getItem('driverToken');
      setToken(storedToken);
      setIsReady(true);
    };
    void checkToken();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor={THEME.background} />
      {token ? (
        <DashboardScreen onLogout={() => setToken(null)} />
      ) : (
        <LoginScreen onLogin={(newToken) => setToken(newToken)} />
      )}
    </SafeAreaView>
  );
}


function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorText(null);
    if (!email || !password) {
      setErrorText('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiCall('/driver-app/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await AsyncStorage.setItem('driverToken', data.accessToken);
      onLogin(data.accessToken);
    } catch (error: unknown) {
      const msg = parseApiErrorMessage(error);
      setErrorText(msg);
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.loginRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.loginHero}>
          <Image
            source={require('./assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="Glorious Gladius logo"
          />
          <Text style={styles.brandName}>GLORIOUS GLADIUS</Text>
          <Text style={styles.title}>Driver sign in</Text>
          <Text style={styles.loginSubtitle}>Simple delivery tools for your shift.</Text>
        </View>

        <View style={styles.loginForm}>
          {errorText ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. driver@fleet.com"
            placeholderTextColor={THEME.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordField}
              placeholder="••••••••"
              placeholderTextColor={THEME.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((s) => !s)}
            >
              <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, loading && { opacity: 0.8 }]} 
            onPress={() => void handleLogin()} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={THEME.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginFooter}>
          <Text style={styles.footerText}>Need help? Contact your manager</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


function AccountMenuModal({
  visible,
  onClose,
  onChangePassword,
  onLogout,
}: {
  visible: boolean;
  onClose: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.menuOverlayRoot}>
        <Pressable style={styles.menuBackdropPress} onPress={onClose} accessibilityLabel="Dismiss menu" />
        <View style={styles.menuPopover} pointerEvents="box-none">
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose();
                onChangePassword();
              }}
              accessibilityRole="button"
              accessibilityLabel="Change password"
            >
              <Text style={styles.menuRowText}>Change password</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onClose();
                void onLogout();
              }}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <Text style={[styles.menuRowText, styles.menuRowDanger]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChangePasswordModal({
  visible,
  onClose,
  onPasswordChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCurrent('');
      setNextPw('');
      setConfirmPw('');
    }
  }, [visible]);

  const submitPassword = async () => {
    if (!current || !nextPw || !confirmPw) {
      Alert.alert('Missing fields', 'Fill in all password fields.');
      return;
    }
    if (nextPw !== confirmPw) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await apiCall('/driver-app/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: current,
          new_password: nextPw,
          new_password_confirm: confirmPw,
        }),
      });
      setCurrent('');
      setNextPw('');
      setConfirmPw('');
      onPasswordChanged();
      onClose();
      Alert.alert('Saved', 'Your password was updated.');
    } catch (e: unknown) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change password</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={THEME.textMuted}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="New password"
              placeholderTextColor={THEME.textMuted}
              value={nextPw}
              onChangeText={setNextPw}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Confirm new password"
              placeholderTextColor={THEME.textMuted}
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.primaryButton, styles.modalButton]}
              onPress={() => void submitPassword()}
              disabled={busy}
            >
              <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Update password'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DashboardScreen({ onLogout }: { onLogout: () => void }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [dutyUpdating, setDutyUpdating] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [trailPoints, setTrailPoints] = useState<MapCoord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'deliveries' | 'completed'>('overview');
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const trailRef = useRef<MapCoord[]>([]);
  const statusBusyRef = useRef<boolean>(false);

  const hasInProgress = useMemo(
    () => deliveries.some((d) => d.status === 'in_progress'),
    [deliveries],
  );
  const onDuty = profile?.onDuty ?? false;
  const needsLocationWatch = onDuty || hasInProgress || showLiveMap;

  const activeDelivery = useMemo(
    () => deliveries.find((d) => d.status === 'in_progress') ?? null,
    [deliveries],
  );

  const pendingCount = useMemo(
    () => deliveries.filter((d) => d.status === 'pending').length,
    [deliveries],
  );
  const showAcceptRouteBanner = useMemo(() => {
    if (pendingCount === 0) return false;
    const activeLength = deliveries.filter((d) => d.status !== 'completed').length;
    if (activeLength === 1 && pendingCount === 1) return false;
    return true;
  }, [deliveries, pendingCount]);

  const fetchProfile = useCallback(async () => {
    try {
      const me = await apiCall('/driver-app/me');
      setProfile({
        name: me.name,
        email: me.email,
        vehicleLabel: me.vehicleLabel,
        onDuty: Boolean(me.onDuty),
      });
    } catch {
      setProfile({ name: '', email: '', vehicleLabel: '', onDuty: false });
    }
  }, []);

  const fetchDeliveries = async (opts?: { showSpinner?: boolean }) => {
    const showSpinner = opts?.showSpinner !== false;
    if (showSpinner) setLoading(true);
    try {
      const data = await apiCall('/driver-app/deliveries');
      const list = Array.isArray(data) ? data : [];
      setDeliveries(
        list.map((d: Delivery) => ({
          ...d,
          status: normalizeDeliveryStatus(d.status),
        })),
      );
    } catch (error: unknown) {
      Alert.alert('Could not load stops', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchWarehouse = useCallback(async () => {
    try {
      const w = await apiCall('/driver-app/settings/warehouse');
      setWarehouse(w);
    } catch {
      setWarehouse(null);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchDeliveries({ showSpinner: false }), fetchWarehouse(), fetchProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchWarehouse]);

  useEffect(() => {
    void fetchDeliveries();
    void fetchWarehouse();
    void fetchProfile();
  }, [fetchProfile, fetchWarehouse]);

  useEffect(() => {
    trailRef.current = [];
    setTrailPoints([]);
  }, [activeDelivery?.id]);

  const setOnDuty = async (value: boolean) => {
    setDutyUpdating(true);
    try {
      const me = await apiCall('/driver-app/me', {
        method: 'PATCH',
        body: JSON.stringify({ onDuty: value }),
      });
      setProfile({
        name: me.name,
        email: me.email,
        vehicleLabel: me.vehicleLabel,
        onDuty: Boolean(me.onDuty),
      });
    } catch (e: unknown) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDutyUpdating(false);
    }
  };

  const acceptFullRoute = async () => {
    if (pendingCount === 0) return;
    setAcceptBusy(true);
    try {
      await apiCall('/driver-app/route/accept', { method: 'POST' });
      await fetchDeliveries();
    } catch (e: unknown) {
      Alert.alert('Accept route failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAcceptBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!needsLocationWatch) {
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch { /* expo-location web bug */ }
        locationSubscription.current = null;
      }
      setDriverPosition(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      let status: Location.PermissionStatus | undefined;
      try {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      } catch (e) {
        console.warn('Location permission request failed', e);
        return;
      }
      if (cancelled || status !== 'granted') {
        if (status !== 'granted' && needsLocationWatch) {
          Alert.alert(
            'Location',
            'Allow location so dispatch can see you while you are on duty or have a stop in progress.',
          );
        }
        return;
      }
      if (locationSubscription.current) return;

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: hasInProgress ? 5000 : 8000,
            distanceInterval: hasInProgress ? 8 : 20,
          },
          async (location) => {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            const pt = { lat, lng };
            setDriverPosition(pt);

            const ll: MapCoord = { latitude: lat, longitude: lng };
            const prev = trailRef.current[trailRef.current.length - 1];
            if (!prev || metersApart({ lat: prev.latitude, lng: prev.longitude }, pt) > 12) {
              trailRef.current = [...trailRef.current, ll].slice(-120);
              setTrailPoints([...trailRef.current]);
            }

            if (hasInProgress) {
              try {
                await apiCall('/driver-app/location', {
                  method: 'PUT',
                  body: JSON.stringify({ lat, lng }),
                });
              } catch {
                /* ignore */
              }
            }
          },
        );
        if (cancelled) {
          try {
            sub.remove();
          } catch { /* expo-location web bug */ }
          return;
        }
        locationSubscription.current = sub;
      } catch (e: unknown) {
        Alert.alert('Location', e instanceof Error ? e.message : 'Could not start location updates.');
      }
    })();

    return () => {
      cancelled = true;
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch { /* expo-location web bug */ }
        locationSubscription.current = null;
      }
    };
  }, [needsLocationWatch, hasInProgress]);

  const handleLogout = async () => {
    // 1. Tell server we are off-duty first (while token is still valid)
    try {
      await apiCall('/driver-app/me', {
        method: 'PATCH',
        body: JSON.stringify({ onDuty: false }),
      });
    } catch { 
      /* ignore if fails, we are logging out anyway */ 
    }

    // 2. Clear location watch
    if (locationSubscription.current) {
      try {
        locationSubscription.current.remove();
      } catch { /* expo-location web bug */ }
      locationSubscription.current = null;
    }

    // 3. Clear auth
    await AsyncStorage.removeItem('driverToken');
    onLogout();
  };

  const updateDeliveryStatus = async (deliveryId: string, next: DeliveryStatus) => {
    if (statusBusyRef.current || statusBusyId === deliveryId) return;
    statusBusyRef.current = true;
    setStatusBusyId(deliveryId);
    try {
      const raw = (await apiCall(`/driver-app/deliveries/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })) as Parameters<typeof deliveryFromApiRow>[0];

      const merged = deliveryFromApiRow(raw);

      setDeliveries((prev) => {
        return prev.map((d) => (d.id === merged.id ? merged : d));
      });

      void fetchDeliveries({ showSpinner: false }).catch(() => {
        /* list already updated from PATCH response */
      });

      if (next === 'in_progress') {
        Alert.alert(
          'Location',
          'While a stop is in progress, your live position is shared with dispatch.',
        );
      }
    } catch (error: unknown) {
      Alert.alert('Update failed', parseApiErrorMessage(error));
    } finally {
      statusBusyRef.current = false;
      setStatusBusyId(null);
    }
  };

  const openRoute = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open maps.'));
  };

  const renderItem = ({ item }: { item: Delivery }) => {
    const activeDeliveries = deliveries.filter((d) => d.status !== 'completed');
    const isInProgress = item.status === 'in_progress';
    const canStart = canStartThisStop(item, activeDeliveries);
    const multiPending = activeDeliveries.length > 1 && activeDeliveries.some((d) => d.status === 'pending');
    const showStart =
      (item.status === 'pending' && !multiPending) || (item.status === 'accepted' && canStart);

    const statusUi: Record<
      DeliveryStatus,
      { bg: string; text: string; label: string }
    > = {
      pending: { bg: THEME.statusBg.pending, text: THEME.status.pending, label: 'Pending' },
      accepted: { bg: THEME.statusBg.accepted, text: THEME.status.accepted, label: 'Accepted' },
      in_progress: {
        bg: THEME.statusBg.in_progress,
        text: THEME.status.in_progress,
        label: 'Active',
      },
      completed: { bg: THEME.statusBg.completed, text: THEME.status.completed, label: 'Done' },
    };

    const sc = statusUi[item.status];

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusBadgeText, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <Text style={styles.sequenceText}>
            #{item.sequenceOrder ?? '—'}
          </Text>
        </View>

        <Text style={styles.addressText} numberOfLines={2}>{item.address}</Text>
        
        <View style={styles.cardInfoRow}>
          <Text style={styles.infoIcon}>👤</Text>
          <Text style={styles.infoText}>{item.recipientName}</Text>
        </View>

        {item.recipientPhone ? (
          <View style={styles.cardInfoRow}>
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={styles.infoText}>{item.recipientPhone}</Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.cardInfoRow}>
            <Text style={styles.infoIcon}>📝</Text>
            <Text style={styles.infoText} numberOfLines={1}>{item.notes}</Text>
          </View>
        ) : null}

        {item.status !== 'completed' ? (
          <View style={styles.cardActions}>
          {item.recipientPhone ? (
            <View style={[styles.cardActionsRow, { marginBottom: 15, gap: 8 }]}>
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: '#2563eb' }]}
                onPress={() => Linking.openURL(`tel:${item.recipientPhone}`)}
                accessibilityLabel="Call customer"
              >
                <Text style={styles.contactBtnText}>📞 Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: '#128c7e' }]}
                onPress={() => Linking.openURL(`https://wa.me/${item.recipientPhone.replace(/\D/g,'')}`)}
                accessibilityLabel="WhatsApp customer"
              >
                <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: '#64748b' }]}
                onPress={() => Linking.openURL(`sms:${item.recipientPhone}`)}
                accessibilityLabel="SMS customer"
              >
                <Text style={styles.contactBtnText}>✉️ SMS</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={[styles.navAction, showStart ? styles.navActionGutter : null]}
              onPress={() => openRoute(item.lat, item.lng)}
            >
              <Text style={styles.navActionText}>Directions</Text>
            </TouchableOpacity>

            {item.status === 'pending' && !multiPending ? (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => void updateDeliveryStatus(item.id, 'in_progress')}
                disabled={statusBusyId !== null}
              >
                {statusBusyId === item.id ? (
                  <ActivityIndicator color={THEME.onPrimary} />
                ) : (
                  <Text style={styles.actionBtnText}>Start</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {item.status === 'accepted' && canStart ? (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => void updateDeliveryStatus(item.id, 'in_progress')}
                disabled={statusBusyId !== null}
              >
                {statusBusyId === item.id ? (
                  <ActivityIndicator color={THEME.onPrimary} />
                ) : (
                  <Text style={styles.actionBtnText}>Start</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {isInProgress ? (
            <TouchableOpacity
              style={[
                styles.completeDeliveryBtn,
                statusBusyId === item.id && styles.completeDeliveryBtnDisabled,
              ]}
              onPress={() => void updateDeliveryStatus(item.id, 'completed')}
               accessibilityRole="button"
               accessibilityLabel="Complete delivery"
              disabled={statusBusyId === item.id}
             >
               {statusBusyId === item.id ? (
                 <ActivityIndicator color={THEME.onPrimary} />
               ) : (
                 <Text style={styles.completeDeliveryBtnText}>Complete delivery</Text>
               )}
            </TouchableOpacity>
          ) : null}
        </View>
        ) : null}

        {item.status === 'pending' && multiPending && (
          <Text style={styles.hintMuted}>Please accept the full route first</Text>
        )}
        {item.status === 'accepted' && !canStart && (
           <Text style={styles.hintMuted}>Complete previous stops first</Text>
        )}
      </View>
    );
  };

  const completedCount = deliveries.filter(d => d.status === 'completed').length;
  const inProgressCount = deliveries.filter(d => d.status === 'in_progress').length;

  return (
    <View style={styles.dashboardContainer}>
      <ActiveRouteMap
        visible={showLiveMap}
        onClose={() => setShowLiveMap(false)}
        warehouse={warehouse}
        activeDelivery={activeDelivery}
        driverCoord={driverPosition}
        trailCoords={trailPoints}
      />

      <AccountMenuModal
        visible={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
        onChangePassword={() => setChangePasswordOpen(true)}
        onLogout={() => void handleLogout()}
      />
      <ChangePasswordModal
        visible={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onPasswordChanged={() => void fetchProfile()}
      />

      <View style={styles.dashHeader}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Image
              source={require('./assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
              accessibilityLabel="Glorious Gladius"
            />
          </View>
          <View style={styles.headerRight}>
            {Platform.OS !== 'web' ? (
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowLiveMap(true)}
                accessibilityLabel="Live route map"
              >
                <Text style={styles.headerIconGlyph}>🗺</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.headerIconBtn, styles.headerIconBtnLast]}
              onPress={() => setAccountMenuOpen(true)}
              accessibilityLabel="Account menu"
            >
              <Text style={styles.headerIconGlyph}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userGreeting}>
          <Text style={styles.helloText}>Hello, {profile?.name?.split(' ')[0] || 'Driver'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftWidth: 0 }]}>
          <Text style={styles.statValue}>{deliveries.length - completedCount}</Text>
          <Text style={styles.statLabel}>Left</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: THEME.status.completed }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: THEME.status.pending }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'deliveries' && styles.tabBtnActive]} onPress={() => setActiveTab('deliveries')}>
          <Text style={[styles.tabText, activeTab === 'deliveries' && styles.tabTextActive]}>Deliveries</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]} onPress={() => setActiveTab('completed')}>
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Finished</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dashScrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={THEME.primary} />
        }
      >
        {loading && deliveries.length === 0 ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={THEME.primary} />
            <Text style={styles.inlineLoadingText}>Loading stops…</Text>
          </View>
        ) : null}

        {activeTab === 'overview' && (
          <>
            <View style={styles.dutySection}>
               <View style={styles.dutyInfo}>
                 <Text style={styles.dutyHeading}>Shift Status</Text>
                 <Text style={styles.dutyDesc}>{onDuty ? 'Online & receiving updates' : 'Offline'}</Text>
               </View>
              <Switch
                value={onDuty}
                onValueChange={(v) => void setOnDuty(v)}
                disabled={dutyUpdating}
                trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                thumbColor={onDuty ? THEME.primary : THEME.card}
              />
            </View>

            {showAcceptRouteBanner && (
              <TouchableOpacity
                style={[styles.acceptBanner, acceptBusy && { opacity: 0.7 }]}
                onPress={() => void acceptFullRoute()}
                disabled={acceptBusy}
                activeOpacity={0.9}
              >
                <View style={styles.acceptBannerContent}>
                  <Text style={styles.acceptBannerTitle}>
                    Accept New Batch
                  </Text>
                  <Text style={styles.acceptBannerSub}>{pendingCount} stops ready for you</Text>
                </View>
                <View style={styles.acceptArrow}>
                  <Text style={styles.acceptArrowText}>→</Text>
                </View>
              </TouchableOpacity>
            )}

            {!showAcceptRouteBanner && activeDelivery && (
              <View style={styles.listSection}>
                <Text style={styles.sectionTitle}>Current Delivery</Text>
                {renderItem({ item: activeDelivery })}
              </View>
            )}
          </>
        )}

        {activeTab === 'deliveries' && (
          <View style={styles.listSection}>
            {showAcceptRouteBanner && (
              <TouchableOpacity
                style={[styles.acceptBanner, acceptBusy && { opacity: 0.7 }]}
                onPress={() => void acceptFullRoute()}
                disabled={acceptBusy}
                activeOpacity={0.9}
              >
                <View style={styles.acceptBannerContent}>
                  <Text style={styles.acceptBannerTitle}>
                    Accept New Batch
                  </Text>
                  <Text style={styles.acceptBannerSub}>{pendingCount} stops ready for you</Text>
                </View>
                <View style={styles.acceptArrow}>
                  <Text style={styles.acceptArrowText}>→</Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Active Deliveries</Text>
             {deliveries.filter(d => d.status !== 'completed').length === 0 && !loading ? (
               <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📭</Text>
                  <Text style={styles.emptyTitle}>All Clear!</Text>
                  <Text style={styles.emptySub}>No active deliveries at the moment.</Text>
               </View>
             ) : (
               deliveries.filter(d => d.status !== 'completed').map(item => (
                 <View key={item.id}>
                   {renderItem({ item })}
                 </View>
               ))
             )}
          </View>
        )}

        {activeTab === 'completed' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Finished Deliveries</Text>
             {deliveries.filter(d => d.status === 'completed').length === 0 && !loading ? (
               <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>None yet</Text>
                  <Text style={styles.emptySub}>Finished deliveries will appear here.</Text>
               </View>
             ) : (
               deliveries.filter(d => d.status === 'completed').map(item => (
                 <View key={item.id}>
                   {renderItem({ item })}
                 </View>
               ))
             )}
          </View>
        )}
        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  // Login Styles
  loginRoot: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loginScroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loginHero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 200,
    height: 120,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: THEME.brand,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  loginForm: {
    width: '100%',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: THEME.radiusSm,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusMd,
    padding: 16,
    fontSize: 16,
    color: THEME.textMain,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusMd,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  passwordField: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: THEME.textMain,
  },
  passwordToggle: {
    paddingHorizontal: 16,
  },
  passwordToggleText: {
    color: THEME.link,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 18,
    borderRadius: THEME.radiusMd,
    alignItems: 'center',
  },
  buttonText: {
    color: THEME.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  loginFooter: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: THEME.textSecondary,
    fontSize: 14,
  },

  // Dashboard Styles
  dashboardContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  dashHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: THEME.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: THEME.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  headerIconBtnLast: {
    marginLeft: 10,
  },
  headerIconGlyph: {
    fontSize: 20,
  },
  headerLogo: {
    height: 40,
    width: 160,
    maxWidth: '100%',
  },
  menuOverlayRoot: {
    flex: 1,
  },
  menuBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  menuPopover: {
    position: 'absolute',
    top: (Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0) + 52,
    right: 16,
    alignItems: 'flex-end',
  },
  menuCard: {
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusMd,
    minWidth: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  menuRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textMain,
  },
  menuRowDanger: {
    color: '#dc2626',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.border,
  },
  userGreeting: {
    alignItems: 'flex-start',
  },
  helloText: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textMain,
  },
  welcomeText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  dashScrollContent: {
    paddingBottom: 40,
  },
  inlineLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: THEME.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)' } as any,
      default: { elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.textMain,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusMd,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: THEME.radiusSm,
  },
  tabBtnActive: {
    backgroundColor: THEME.border,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  tabTextActive: {
    color: THEME.textMain,
    fontWeight: '700',
  },
  dutySection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 20,
    padding: 20,
    borderRadius: THEME.radiusMd,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  dutyInfo: {
    flex: 1,
  },
  dutyHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textMain,
  },
  dutyDesc: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  acceptBanner: {
    flexDirection: 'row',
    backgroundColor: THEME.primary,
    marginHorizontal: 20,
    marginBottom: 25,
    padding: 20,
    borderRadius: THEME.radiusMd,
    alignItems: 'center',
  },
  acceptBannerContent: {
    flex: 1,
  },
  acceptBannerTitle: {
    color: THEME.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  acceptBannerSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 4,
  },
  acceptArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptArrowText: {
    color: THEME.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  listSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 12,
  },
  deliveryCard: {
    backgroundColor: THEME.card,
    borderRadius: THEME.radiusMd,
    padding: 20,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sequenceText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  addressText: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.textMain,
    lineHeight: 24,
    marginBottom: 15,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: THEME.textSecondary,
    flex: 1,
  },
  cardActions: {
    marginTop: 15,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  contactBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  contactBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  navAction: {
    flex: 1,
    backgroundColor: THEME.background,
    paddingVertical: 12,
    borderRadius: THEME.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  navActionGutter: {
    marginRight: 10,
  },
  navActionText: {
    color: THEME.textMain,
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnPrimary: {
    flex: 1.2,
    minWidth: 100,
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: THEME.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSuccess: {
    flex: 1.2,
    minWidth: 100,
    backgroundColor: '#059669', // Emerald 600
    paddingVertical: 12,
    borderRadius: THEME.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: THEME.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  completeDeliveryBtn: {
    marginTop: 12,
    width: '100%',
    minHeight: 48,
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: THEME.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeDeliveryBtnDisabled: {
    opacity: 0.85,
  },
  completeDeliveryBtnText: {
    color: THEME.onPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  hintMuted: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textMain,
  },
  emptySub: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 5,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textMain,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.link,
  },
  modalButton: {
    marginTop: 15,
  },
});

