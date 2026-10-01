const VERSION_PATTERN = /\/v(\d+)(?:\/|$)/;

function versionsFromPaths(paths = {}) {
  const versions = new Set();

  for (const path of Object.keys(paths)) {
    const match = path.match(VERSION_PATTERN);
    if (match) versions.add(Number(match[1]));
  }

  return [...versions].sort((a, b) => a - b);
}

export function detectApiVersions(openApi) {
  return versionsFromPaths(openApi?.paths);
}

export function buildVersionPolicy(openApi, onLegacy) {
  const versions = detectApiVersions(openApi);
  const currentVersion = versions.length ? Math.max(...versions) : null;
  const legacyVersions = versions.filter(version => version < currentVersion);

  for (const version of legacyVersions) {
    onLegacy?.({
      version: `v${version}`,
      currentVersion: currentVersion == null ? null : `v${currentVersion}`,
      reason: `A newer API version (v${currentVersion}) is present in the OpenAPI contract.`,
    });
  }

  return {
    currentVersion: currentVersion == null ? null : `v${currentVersion}`,
    versions: versions.map(version => `v${version}`),
    legacyVersions: legacyVersions.map(version => `v${version}`),
  };
}
