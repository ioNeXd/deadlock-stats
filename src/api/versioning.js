const VERSION_PATTERN = /\/v(\d+)(?=\/|$)/;
const OPERATION_KEYS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

export function versionedPath(path) {
  const match = path.match(VERSION_PATTERN);
  if (!match) return null;

  return {
    version: Number(match[1]),
    resourcePath: path.replace(VERSION_PATTERN, "") || "/",
  };
}

function operationsFrom(pathItem) {
  return Object.entries(pathItem ?? {})
    .filter(([key, value]) => OPERATION_KEYS.has(key) && value && typeof value === "object")
    .map(([, operation]) => operation);
}

export function entriesFrom(openApi) {
  return Object.entries(openApi?.paths ?? {})
    .map(([path, pathItem]) => {
      const operations = operationsFrom(pathItem);

      return {
        path,
        ...versionedPath(path),
        deprecated: operations.length > 0 && operations.every(
          operation => operation.deprecated === true,
        ),
      };
    })
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
          ? "The OpenAPI contract marks this resource as deprecated."
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

function stateMap(openApi) {
  const entries = entriesFrom(openApi);
  const map = new Map();

  for (const entry of entries) {
    const key = entry.resourcePath;
    const existing = map.get(key);

    if (!existing || entry.version > existing.versionNumber) {
      map.set(key, {
        path: entry.path,
        versionNumber: entry.version,
        deprecated: entry.deprecated,
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
    if (!previous) continue;

    const versionChanged = next.versionNumber > previous.versionNumber;
    const newlyDeprecated = next.deprecated && !previous.deprecated;

    if (versionChanged || newlyDeprecated) {
      const event = {
        type: "entered_legacy",
        resourcePath,
        legacyPath: versionChanged ? previous.path : next.path,
        legacyVersion: versionChanged ? previous.version : next.version,
        currentPath: versionChanged ? next.path : null,
        currentVersion: versionChanged ? next.version : null,
        reason: newlyDeprecated
          ? "The OpenAPI contract marked the resource as deprecated."
          : "A newer API version replaced the resource.",
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

  const publicState = state => Object.fromEntries(
    [...state.entries()].map(([key, value]) => [key, {
      path: value.path,
      version: `v${value.versionNumber}`,
      deprecated: value.deprecated,
    }]),
  );

  return {
    events,
    previous: publicState(previousState),
    current: publicState(nextState),
  };
}
