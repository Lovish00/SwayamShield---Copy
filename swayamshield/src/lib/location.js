export const LOCATION_PERMISSION_MESSAGE =
  'Location access required to find nearby hospitals. Please enable location services.';

const LAST_LOCATION_STORAGE_KEY = 'ss_last_known_location';
const DEFAULT_CHANDIGARH_LOCATION = { latitude: 30.7333, longitude: 76.7794 };

function toCoords(position) {
  return {
    latitude: Number(position.coords.latitude.toFixed(6)),
    longitude: Number(position.coords.longitude.toFixed(6)),
  };
}

function saveLastLocation(location) {
  try {
    localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore storage failures; location retrieval should continue.
  }
}

function getLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.latitude) && Number.isFinite(parsed?.longitude)) {
      return {
        latitude: Number(parsed.latitude),
        longitude: Number(parsed.longitude),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function requestPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function detectCurrentLocation({ allowFallback = true } = {}) {
  if (!navigator.geolocation) {
    if (!allowFallback) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    const saved = getLastLocation();
    return {
      ...(saved || DEFAULT_CHANDIGARH_LOCATION),
      isFallback: true,
      message: 'Live location is unavailable on this browser. Showing nearest hospitals from a fallback location.',
    };
  }

  try {
    // First attempt: high accuracy for best nearby-hospital matching.
    const highAccuracyPosition = await requestPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });

    const coordinates = toCoords(highAccuracyPosition);
    saveLastLocation(coordinates);
    return { ...coordinates, isFallback: false, message: '' };
  } catch (highAccuracyError) {
    try {
      // Retry with less strict settings in case high-accuracy GPS is unavailable.
      const standardPosition = await requestPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });

      const coordinates = toCoords(standardPosition);
      saveLastLocation(coordinates);
      return { ...coordinates, isFallback: false, message: '' };
    } catch (locationError) {
      if (!allowFallback) {
        throw locationError;
      }

      const saved = getLastLocation();
      return {
        ...(saved || DEFAULT_CHANDIGARH_LOCATION),
        isFallback: true,
        message: mapLocationError(locationError),
      };
    }
  }
}

export function mapLocationError(error) {
  if (typeof error?.message === 'string' && /secure context|secure origin/i.test(error.message)) {
    return 'Location works only on HTTPS or localhost. Please open the app in a secure context.';
  }
  if (error?.code === 1) {
    return LOCATION_PERMISSION_MESSAGE;
  }
  if (error?.code === 3) {
    return 'Unable to detect location in time. Showing hospitals from last known location.';
  }
  if (error?.code === 2) {
    return 'Unable to detect your exact location right now. Showing hospitals from last known location.';
  }
  return error?.message || 'Unable to access your current location.';
}
