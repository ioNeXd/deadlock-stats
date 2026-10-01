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

function resolveSchema(value, contract, seen = new Set()) {
  if (!value || typeof value !== "object" || !contract) return value;
  if (Array.isArray(value)) return value.map(item => resolveSchema(item, contract, seen));

  if (value.$ref && value.$ref.startsWith("#/")) {
    if (seen.has(value.$ref)) return { ...value };
    const resolved = resolveLocalRef(value, contract);
    if (!resolved || resolved === value) return value;
    const nextSeen = new Set(seen);
    nextSeen.add(value.$ref);
    const siblings = { ...value };
    delete siblings.$ref;
    return resolveSchema({ ...resolved, ...siblings }, contract, nextSeen);
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) result[key] = resolveSchema(child, contract, seen);
  return result;
}

function parameterSchema(parameter, contract = null) {
  return resolveSchema(parameter?.schema ?? {}, contract);
}

function enumValues(schema) {
  if (Array.isArray(schema?.enum)) return schema.enum;
  const variants = [...(schema?.oneOf ?? []), ...(schema?.anyOf ?? [])];
  const values = variants.flatMap(item => Array.isArray(item?.enum) ? item.enum : item?.const !== undefined ? [item.const] : []);
  if (schema?.const !== undefined) values.push(schema.const);
  return [...new Set(values)];
}

function schemaType(schema) {
  if (typeof schema?.type === "string") return schema.type;
  if (Array.isArray(schema?.type)) return schema.type.find(type => type !== "null") ?? "string";
  const variants = [...(schema?.oneOf ?? []), ...(schema?.anyOf ?? []), ...(schema?.allOf ?? [])];
  if (variants.length) return variants.map(item => schemaType(item)).find(type => type !== "null") ?? "string";
  if (schema?.const !== undefined) {
    if (schema.const === null) return "null";
    return typeof schema.const === "boolean" ? "boolean" : typeof schema.const === "number" ? "number" : "string";
  }
  if (schema?.$ref) return "object";
  return "string";
}

function schemaNullable(schema) {
  const nullableType = Array.isArray(schema?.type) && schema.type.includes("null");
  const variants = [...(schema?.oneOf ?? []), ...(schema?.anyOf ?? [])];
  return nullableType || variants.some(item => item?.type === "null" || item?.const === null);
}

function parameterDefaults(parameter, contract = null) {
  const schema = parameterSchema(parameter, contract);
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

function requestBodyInfo(requestBody, contract = null) {
  const content = requestBody?.content ?? {};
  return Object.entries(content).map(([mediaType, media]) => ({
    mediaType,
    required: requestBody?.required === true,
    schema: resolveSchema(media?.schema ?? null, contract),
    example: media?.example,
    examples: media?.examples ?? {},
  }));
}

function responseInfo(responses, contract = null) {
  return Object.entries(responses ?? {}).map(([status, response]) => ({
    status,
    description: response?.description ?? "",
    content: Object.entries(response?.content ?? {}).map(([mediaType, media]) => ({
      mediaType,
      schema: resolveSchema(media?.schema ?? null, contract),
      example: media?.example,
      examples: media?.examples ?? {},
    })),
    headers: Object.entries(response?.headers ?? {}).map(([name, header]) => ({
      name,
      ...resolveLocalRef(header, contract),
      schema: resolveSchema(resolveLocalRef(header, contract)?.schema ?? null, contract),
    })),
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

      const parameters = mergeParameters(pathItem, operation, contract).map(parameter => ({
        ...parameter,
        schema: resolveSchema(parameter.schema ?? {}, contract),
      }));
      const requestBody = resolveLocalRef(operation.requestBody, contract) ?? null;
      const responses = Object.fromEntries(Object.entries(operation.responses ?? {}).map(([status, response]) => [
        status,
        response ? {
          ...response,
          headers: Object.fromEntries(Object.entries(response.headers ?? {}).map(([name, header]) => {
            const resolved = resolveLocalRef(header, contract) ?? header;
            return [name, { ...resolved, schema: resolveSchema(resolved.schema ?? null, contract) }];
          })),
          content: Object.fromEntries(Object.entries(response.content ?? {}).map(([mediaType, media]) => [
            mediaType, media ? { ...media, schema: resolveSchema(media.schema ?? null, contract) } : media,
          ])),
        } : response,
      ]));
      const result = {
        operationId: operation.operationId ?? method.toUpperCase() + " " + path,
        method: method.toUpperCase(), path,
        summary: operation.summary ?? operation.description?.split("\n")[0] ?? "",
        description: operation.description ?? "", deprecated: operation.deprecated === true,
        tags: Array.isArray(operation.tags) ? operation.tags : [], parameters,
        requestBody: requestBody ? {
          ...requestBody,
          content: Object.fromEntries(Object.entries(requestBody.content ?? {}).map(([mediaType, media]) => [
            mediaType, media ? { ...media, schema: resolveSchema(media.schema ?? null, contract) } : media,
          ])),
        } : null,
        responses, security: securityInfo(operation, contract),
        servers: operation.servers ?? contract.servers ?? [],
      };
      Object.defineProperty(result, "_contract", { value: contract, enumerable: false });
      operations.push(result);
    }
  }

  return operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function describeOperation(operation, contract = null) {
  const parameters = (operation?.parameters ?? []).map(parameter => resolveLocalRef(parameter, contract)).filter(Boolean);
  const resolvedOperation = {
    ...operation,
    parameters,
    requestBody: resolveLocalRef(operation?.requestBody, contract) ?? null,
    responses: Object.fromEntries(Object.entries(operation?.responses ?? {}).map(([status, response]) => [status, resolveLocalRef(response, contract)])),
  };
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
      schema: parameterSchema(parameter, contract),
      type: schemaType(parameterSchema(parameter, contract)),
      nullable: schemaNullable(parameterSchema(parameter, contract)),
      enum: enumValues(parameterSchema(parameter, contract)),
      constraints: parameterDefaults(parameter, contract),
    })),
    requestBodyInfo: requestBodyInfo(resolvedOperation.requestBody, contract),
    responseInfo: responseInfo(resolvedOperation.responses, contract),
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

function serializeQueryParameter(parameter, value) {
  if (!Array.isArray(value)) return value;

  const style = parameter?.style ?? "form";
  const explode = parameter?.explode ?? (style === "form");
  const commaSeparated = /comma separated/i.test(parameter?.description ?? "");

  if (style === "form" && (commaSeparated || explode === false)) return value.join(",");
  return value;
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
    const schema = parameterSchema(parameter, operation?._contract);
    if (value === undefined || value === "") {
      if (parameter.required) throw new TypeError(`Missing required parameter: ${parameter.name}`);
      continue;
    }

    const coerced = coerceParameter(value, schema);

    if (parameter.in === "path") {
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(coerced)));
    } else if (parameter.in === "query") {
      query[parameter.name] = serializeQueryParameter(parameter, coerced);
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
  resolveSchema,
  responseInfo,
  schemaNullable,
  schemaType,
};
