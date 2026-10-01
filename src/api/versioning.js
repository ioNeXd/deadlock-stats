const VERSION_PATTERN = /\/v(\d+)(?=\/|$)/;

function versionedPath(path) {
  const match = path.match(VERSION_PATTERN);
  if (!match) return null;

  return {
    version: Number(match[1]),
    resourcePath: path.replace(VERSION_PATTERN, "/"),
  };
}

function entriesFrom(openApi) {
  return Object.entries(openApi?.paths ?? {})
    .map(([path, pathItem]) => ({
      path,
      ...versionedPath(path),
      deprecated: Object.values(pathItem ?? {}).some(
        operation => operation && typeof operation === "object" && operation.deprecated === true,
      ),
    }))
    .filter(entry => entry.version != null);
}

export function detectApiVersions(openApi) {
  const versions = new Set();

  for (const entry of entriesFrom(openApi)) versions.add(entry.version);

  return [...versions].sort((a, b) => a - b);
}

export function buildVersionPolicy(openApi, onLegacy) {
  const entries = entriesFrom(openApi);
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

    if (entry.deprecated || newer) {
      const event = {
        type: "legacy",
        path: entry.path,
        version: `v${entry.version}`,
        currentPath: newer?.path ?? null,
        currentVersion: newer ? `v${newer.version}` : null,
        reason: entry.deprecated
          ? "The OpenAPI contract marks this operation as deprecated."
          : "A newer API version exists for the same resource path.",
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

function resourceKey(entry) {
  return entry.resourcePath;
}

function stateMap(openApi) {
  const entries = entriesFrom(openApi);
  const map = new Map();

  for (const entry of entries) {
    const key = resourceKey(entry);
    const existing = map.get(key);

    if (!existing || entry.version > existing.version) {
      map.set(key, {
        path: entry.path,
        version: `v${entry.version}`,
      });
    }
  }

  return map;
}

export function reconcileVersionPolicy(previousOpenApi, nextOpenApi, callbacks = {}) {
  const previousEntries = entriesFrom(previousOpenApi);
  const nextEntries = entriesFrom(nextOpenApi);
  const previousState = stateMap(previousOpenApi);
  const nextState = stateMap(nextOpenApi);
  const previousPaths = new Set(previousEntries.map(entry => entry.path));
  const events = [];

  for (const entry of nextEntries) {
    if (!previousPaths.has(entry.path)) {
      const event = {
        type: "version_discovered",
        path: entry.path,
        version: `v${entry.version}`,
      };

      events.push(event);
      callbacks.onVersionDiscovered?.(event);
    }
  }

  for (const [resourcePath, next] of nextState) {
    const previous = previousState.get(resourcePath);
    if (!previous || previous.version === next.version) continue;

    if (Number(next.version.slice(1)) > Number(previous.version.slice(1))) {
      const event = {
        type: "entered_legacy",
        resourcePath,
        legacyPath: previous.path,
        legacyVersion: previous.version,
        currentPath: next.path,
        currentVersion: next.version,
      };

      events.push(event);
      callbacks.onEnterLegacy?.(event);
    }
  }

  for (const [resourcePath, previous] of previousState) {
    if (!nextState.has(resourcePath)) {
      const event = {
        type: "resource_removed",
        resourcePath,
        path: previous.path,
        version: previous.version,
      };

      events.push(event);
      callbacks.onResourceRemoved?.(event);
    }
  }

  return {
    events,
    previous: Object.fromEntries(previousState),
    current: Object.fromEntries(nextState),
  };
}
