import { apiRequest } from "../api/client.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

function resolveLocalRef(value, contract) {
  if (!value?.$ref || !contract) return value;
  if (!value.$ref.startsWith("#/")) return value;
  return value.$ref.slice(2).split("/").reduce((current, key) => current?.[key], contract);
}

function pathParameters(operation) {
  return (operation?.parameters ?? []).filter(parameter => parameter?.in === "path");
}

function queryParameters(operation) {
  return (operation?.parameters ?? []).filter(parameter => parameter?.in === "query");
}

function parameterSchema(parameter) {
  return parameter?.schema ?? {};
}

function enumValues(schema) {
  if (Array.isArray(schema?.enum)) return schema.enum;
  if (Array.isArray(schema?.oneOf)) {
    return schema.oneOf.flatMap(item => Array.isArray(item?.enum) ? item.enum : []);
  }
  return [];
}

function schemaType(schema) {
  if (typeof schema?.type === "string") return schema.type;
  if (Array.isArray(schema?.type)) return schema.type.find(type => type !== "null") ?? "string";
  if (Array.isArray(schema?.oneOf)) {
    return schema.oneOf.map(item => schemaType(item)).find(type => type !== "null") ?? "string";
  }
  if (schema?.$ref) return "object";
  return "string";
}

function schemaNullable(schema) {
  return Array.isArray(schema?.type) && schema.type.includes("null")
    || Array.isArray(schema?.oneOf) && schema.oneOf.some(item => item?.type === "null");
}

function parameterDefaults(parameter) {
  const schema = parameterSchema(parameter);
  return {
    default: schema?.default ?? null,
    minimum: schema?.minimum ?? null,
    maximum: schema?.maximum ?? null,
    minItems: schema?.minItems ?? null,
    maxItems: schema?.maxItems ?? null,
  };
}

function mergeParameters(pathItem, operation, contract) {
  const merged = new Map();

  for (const parameter of Array.isArray(pathItem?.parameters) ? pathItem.parameters : []) {
    const resolved = resolveLocalRef(parameter, contract);
    if (resolved?.name && resolved?.in) merged.set(`${resolved.in}:${resolved.name}`, resolved);
  }

  for (const parameter of Array.isArray(operation?.parameters) ? operation.parameters : []) {
    const resolved = resolveLocalRef(parameter, contract);
    if (resolved?.name && resolved?.in) merged.set(`${resolved.in}:${resolved.name}`, resolved);
  }

  return [...merged.values()];
}

function requestBodyInfo(requestBody) {
  const content = requestBody?.content ?? {};
  return Object.entries(content).map(([mediaType, media]) => ({
    mediaType,
    required: requestBody?.required === true,
    schema: media?.schema ?? null,
    example: media?.example,
    examples: media?.examples ?? {},
  }));
}

function responseInfo(responses) {
  return Object.entries(responses ?? {}).map(([status, response]) => ({
    status,
    description: response?.description ?? "",
    content: Object.entries(response?.content ?? {}).map(([mediaType, media]) => ({
      mediaType,
      schema: media?.schema ?? null,
      example: media?.example,
      examples: media?.examples ?? {},
    })),
    headers: Object.keys(response?.headers ?? {}),
  }));
}

function securityInfo(operation, contract) {
  const security = operation?.security ?? contract?.security ?? [];
  return Array.isArray(security) ? security : [];
}

export function listApiOperations(contract, { includeDeprecated = true } = {}) {
  const paths = contract?.paths ?? {};
  const operations = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      if (!includeDeprecated && operation.deprecated) continue;

      const parameters = mergeParameters(pathItem, operation, contract);
      operations.push({
        operationId: operation.operationId ?? `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? operation.description?.split("\n")[0] ?? "",
        description: operation.description ?? "",
        deprecated: operation.deprecated === true,
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        parameters,
        requestBody: operation.requestBody ?? null,
        responses: operation.responses ?? {},
        security: securityInfo(operation, contract),
        servers: operation.servers ?? contract.servers ?? [],
      });
    }
  }

  return operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function describeOperation(operation, contract = null) {
  const parameters = (operation?.parameters ?? []).map(parameter => resolveLocalRef(parameter, contract)).filter(Boolean);
  const resolvedOperation = { ...operation, parameters };
  return {
    ...resolvedOperation,
    pathParameters: pathParameters(resolvedOperation),
    queryParameters: queryParameters(resolvedOperation),
    parameterSummary: resolvedOperation.parameters.map(parameter => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required === true,
      deprecated: parameter.deprecated === true,
      description: parameter.description ?? "",
      schema: parameterSchema(parameter),
      type: schemaType(parameterSchema(parameter)),
      nullable: schemaNullable(parameterSchema(parameter)),
      enum: enumValues(parameterSchema(parameter)),
      constraints: parameterDefaults(parameter),
    })),
    requestBodyInfo: requestBodyInfo(operation.requestBody),
    responseInfo: responseInfo(operation.responses),
    security: securityInfo(operation, contract),
  };
}

function coerceScalar(value, schema) {
  const type = schemaType(schema);
  if (type === "integer" || type === "number") return Number(value);
  if (type === "boolean") return value === true || value === "true";
  return value;
}

function coerceParameter(value, schema) {
  if (value === "" || value === null || value === undefined) return undefined;

  if (schemaType(schema) === "array") {
    const values = Array.isArray(value) ? value : String(value).split(",").map(item => item.trim()).filter(Boolean);
    return values.map(item => coerceScalar(item, schema?.items ?? {}));
  }

  return coerceScalar(value, schema);
}

function selectRequestMediaType(operation, values) {
  const available = requestBodyInfo(operation.requestBody);
  if (!available.length) return null;
  const requested = values.__contentType;
  return available.find(item => item.mediaType === requested)?.mediaType ?? available[0].mediaType;
}

export function buildRequest(operation, values = {}) {
  let path = operation.path;
  const query = {};

  for (const parameter of operation.parameters) {
    const value = values[parameter.name];
    const schema = parameterSchema(parameter);
    if (value === undefined || value === "") {
      if (parameter.required) throw new TypeError(`Missing required parameter: ${parameter.name}`);
      continue;
    }

    const coerced = coerceParameter(value, schema);

    if (parameter.in === "path") {
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(coerced)));
    } else if (parameter.in === "query") {
      query[parameter.name] = coerced;
    }
  }

  let body;
  const mediaType = selectRequestMediaType(operation, values);
  const hasBody = values.__body !== undefined && values.__body !== "";
  if (operation.requestBody?.required && !hasBody) {
    throw new TypeError("Missing required request body");
  }
  if (hasBody) {
    if (typeof values.__body !== "string") {
      body = values.__body;
    } else if (mediaType?.includes("json")) {
      try {
        body = JSON.parse(values.__body);
      } catch {
        throw new TypeError("Request body must contain valid JSON for the selected content type.");
      }
    } else {
      body = values.__body;
    }
  }

  return {
    path,
    method: operation.method,
    query,
    body,
    mediaType,
  };
}

export async function executeOperation(operation, values = {}, options = {}) {
  const request = buildRequest(operation, values);
  const headers = new Headers(options.headers);

  if (request.mediaType && !headers.has("Content-Type")) {
    headers.set("Content-Type", request.mediaType);
  }

  const result = await apiRequest(request.path, {
    ...options,
    method: request.method,
    query: request.query,
    body: request.body,
    headers,
    cache: options.cache ?? false,
    dedupe: options.dedupe ?? false,
  });

  return { ...result, request };
}

export {
  coerceParameter,
  enumValues,
  parameterSchema,
  requestBodyInfo,
  responseInfo,
  schemaNullable,
  schemaType,
};
