const inheritedVariables = [
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TZ",
  "TMPDIR",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
];

/**
 * The environment every provider CLI runs with: an allow-list, so API keys, database URLs and
 * this service's own secrets never reach a child. Without an API key in the environment the CLIs
 * can only use the subscription sign-in stored in the user's home.
 */
export function createCliEnvironment(extra: Record<string, string>) {
  const environment: Record<string, string> = {};
  for (const name of inheritedVariables) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return {
    ...environment,
    BROWSER: "true",
    DISABLE_AUTOUPDATER: "1",
    NO_COLOR: "1",
    ...extra,
  };
}

export function requireEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}
