const VERSION_PATTERN = /\/v(\d+)(?=\/|$)/;

function versionedPath(path) {
  const match = path.match(VERSION_PATTERN);
  if (!match) return null;

  return {
    version: Number(match[1]),
    resourcePath: path.replace(VERSION_PATTERN, "/"),
  };
}

export function detectApiVersions(openApi) {
  const versions = new Set();

  for (const path of Object.keys(openApi?.paths ?? {})) {
    const entry = versionedPath(path);
    if (entry) versions.add(entry.version);
  }

  return [...versions].sort((a, b) => a - b);
}

export function buildVersionPolicy(openApi, onLegacy) {
  const paths = openApi?.paths ?? {};
  const entries = Object.keys(paths)
    .map(path => ({ path, ...versionedPath(path) }))
    .filter(entry => entry.version != null);

  const versions = detectApiVersions(openApi);
  const legacy = [];
  const current = [];

  for (const entry of entries) {
    const newer = entries
      .filter(candidate =>
        candidate.resourcePath === entry.resourcePath &&
        candidate.version > entry.version
      )
      .sort((a, b) => b.version - a.version)[0];

    if (newer) {
      const event = {
        path: entry.path,
        version: `v${entry.version}`,
        currentPath: newer.path,
        currentVersion: `v${newer.version}`,
        reason: `A newer API version exists for the same resource path.`,
      };

      legacy.push(event);
      onLegacy?.(event);
    } else {
      current.push({
        path: entry.path,
        version: `v${entry.version}`,
      });
    }
  }

  return {
    versions: versions.map(version => `v${version}`),
    legacy,
    current,
  };
}
