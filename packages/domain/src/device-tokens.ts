export const deviceTokenNameMaximumLength = 80;
export const deviceTokenLifetimeDays = 365;
export const deviceTokenMaximumActiveCount = 10;
export const deviceTokenPrefix = "opm_";
export const deviceTokenExpiringSoonDays = 30;
export const deviceTokenActivityWindowDays = 7;

const dayInMilliseconds = 24 * 60 * 60 * 1_000;

export function normalizeDeviceTokenName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getDeviceTokenExpiration(createdAt = new Date()) {
  return new Date(createdAt.getTime() + deviceTokenLifetimeDays * dayInMilliseconds);
}

export function isDeviceTokenExpiringSoon(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() - now.getTime() <= deviceTokenExpiringSoonDays * dayInMilliseconds;
}

export function getDeviceTokenActivityStart(now = new Date()) {
  return new Date(now.getTime() - deviceTokenActivityWindowDays * dayInMilliseconds);
}

export function hasDeviceTokenFormat(value: string) {
  return new RegExp(`^${deviceTokenPrefix}[A-Za-z0-9_-]{43}$`).test(value);
}
