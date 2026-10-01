import { apiRequest } from "../api/client.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

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

export function listApiOperations(contract, { includeDeprecated = true } = {}) {
  const paths = contract?.paths ?? {};
  const operations = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      if (!includeDeprecated && operation.deprecated) continue;

      operations.push({
        operationId: operation.operationId ?? `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        summary: operation.summary ?? operation.description?.split("\n")[0] ?? "",
        description: operation.description ?? "",
        deprecated: operation.deprecated === true,
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        parameters: Array.isArray(operation.parameters) ? operation.parameters : [],
        requestBody: operation.requestBody ?? null,
        responses: operation.responses ?? {},
      });
    }
  }

  return operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function describeOperation(operation) {
  return {
    ...operation,
    pathParameters: pathParameters(operation),
    queryParameters: queryParameters(operation),
    parameterSummary: operation.parameters.map(parameter => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required === true,
      deprecated: parameter.deprecated === true,
      schema: parameterSchema(parameter),
      enum: enumValues(parameterSchema(parameter)),
    })),
  };
}

function coerceParameter(value, schema) {
  if (value === "" || value === null || value === undefined) return undefined;
  if (schema?.type === "integer" || schema?.type === "number") return Number(value);
  if (schema?.type === "boolean") return value === true || value === "true";
  if (schema?.type === "array") {
    return Array.isArray(value) ? value : String(value).split(",").map(item => item.trim()).filter(Boolean);
  }
  return value;
}

export function buildRequest(operation, values = {}) {
  let path = operation.path;
  const query = {};

  for (const parameter of operation.parameters) {
    const value = values[parameter.name];
    const schema = parameterSchema(parameter);
    if (value === undefined || value === "") continue;

    const coerced = coerceParameter(value, schema);

    if (parameter.in === "path") {
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(coerced)));
    } else if (parameter.in === "query") {
      query[parameter.name] = coerced;
    }
  }

  let body;
  if (values.__body !== undefined && values.__body !== "") {
    body = typeof values.__body === "string" ? JSON.parse(values.__body) : values.__body;
  }

  return {
    path,
    method: operation.method,
    query,
    body,
  };
}

export async function executeOperation(operation, values = {}, options = {}) {
  const request = buildRequest(operation, values);
  const result = await apiRequest(request.path, {
    ...options,
    method: request.method,
    query: request.query,
    body: request.body,
    cache: options.cache ?? false,
    dedupe: options.dedupe ?? false,
  });

  return { ...result, request };
}
