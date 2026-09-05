export const deviceTokenNameMaximumLength = 80;
export const deviceTokenLifetimeDays = 365;
export const deviceTokenMaximumActiveCount = 10;
export const deviceTokenPrefix = "opm_";

export function normalizeDeviceTokenName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getDeviceTokenExpiration(createdAt = new Date()) {
  return new Date(createdAt.getTime() + deviceTokenLifetimeDays * 24 * 60 * 60 * 1_000);
}

export function hasDeviceTokenFormat(value: string) {
  return new RegExp(`^${deviceTokenPrefix}[A-Za-z0-9_-]{43}$`).test(value);
}
