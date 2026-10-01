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
    if (Array.isArray(schema.const)) return "array";
    if (typeof schema.const === "object") return "object";
    return typeof schema.const === "boolean" ? "boolean" : typeof schema.const === "number" ? "number" : "string";
  }
  if (Array.isArray(schema?.enum) && schema.enum.length) {
    const first = schema.enum[0];
    if (first === null) return "null";
    if (Array.isArray(first)) return "array";
    if (typeof first === "object") return "object";
    return typeof first === "boolean" ? "boolean" : typeof first === "number" ? "number" : "string";
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

function resolveExamples(examples, contract) {
  return Object.fromEntries(Object.entries(examples ?? {}).map(([name, example]) => {
    const resolved = resolveLocalRef(example, contract) ?? example;
    return [name, resolved];
  }));
}

function requestBodyInfo(requestBody, contract = null) {
  const content = requestBody?.content ?? {};
  return Object.entries(content).map(([mediaType, media]) => ({
    mediaType,
    required: requestBody?.required === true,
    schema: resolveSchema(media?.schema ?? null, contract),
    example: media?.example,
    examples: resolveExamples(media?.examples, contract),
    encoding: media?.encoding ?? {},
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
      examples: resolveExamples(media?.examples, contract),
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

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = resolveLocalRef(rawPathItem, contract);
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      if (!includeDeprecated && operation.deprecated) continue;

      const parameters = mergeParameters(pathItem, operation, contract).map(parameter => ({
        ...parameter,
        schema: resolveSchema(parameter.schema ?? {}, contract),
      }));
      const requestBody = resolveLocalRef(operation.requestBody, contract) ?? null;
      const responses = Object.fromEntries(Object.entries(operation.responses ?? {}).map(([status, response]) => {
        const resolvedResponse = resolveLocalRef(response, contract) ?? response;
        return [status, resolvedResponse ? {
          ...resolvedResponse,
          headers: Object.fromEntries(Object.entries(resolvedResponse.headers ?? {}).map(([name, header]) => {
            const resolved = resolveLocalRef(header, contract) ?? header;
            return [name, { ...resolved, schema: resolveSchema(resolved.schema ?? null, contract) }];
          })),
          content: Object.fromEntries(Object.entries(resolvedResponse.content ?? {}).map(([mediaType, media]) => [
            mediaType, media ? { ...media, schema: resolveSchema(media.schema ?? null, contract) } : media,
          ])),
        } : resolvedResponse];
      }));
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
  contract = contract ?? operation?._contract ?? null;
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

function schemaAllowsNull(schema) {
  return schemaNullable(schema) || schema?.type === "null" || schema?.const === null;
}

function validateEnum(value, schema) {
  const values = enumValues(schema);
  if (!values.length) return;
  const valid = values.some(item => Object.is(item, value) || (typeof item === "number" && Number(item) === value));
  if (!valid) throw new TypeError("Value is not allowed by the parameter enum.");
}

function coerceScalar(value, schema) {
  if (value === null) {
    if (schemaAllowsNull(schema)) return null;
    throw new TypeError("Null is not allowed by the parameter schema.");
  }

  const type = schemaType(schema);
  if (type === "integer" || type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError("Parameter must be a finite number.");
    if (type === "integer" && !Number.isInteger(number)) throw new TypeError("Parameter must be an integer.");
    validateEnum(number, schema);
    if (schema.minimum !== undefined && number < schema.minimum) throw new TypeError("Parameter is below the minimum.");
    if (schema.maximum !== undefined && number > schema.maximum) throw new TypeError("Parameter exceeds the maximum.");
    return number;
  }

  if (type === "boolean") {
    if (value === true || value === "true") {
      validateEnum(true, schema);
      return true;
    }
    if (value === false || value === "false") {
      validateEnum(false, schema);
      return false;
    }
    throw new TypeError("Parameter must be a boolean.");
  }

  const result = String(value);
  validateEnum(result, schema);
  if (schema.minLength !== undefined && result.length < schema.minLength) throw new TypeError("Parameter is shorter than minLength.");
  if (schema.maxLength !== undefined && result.length > schema.maxLength) throw new TypeError("Parameter exceeds maxLength.");
  return result;
}

function coerceParameter(value, schema, parameter = null) {
  if (value === "" || value === undefined) return undefined;
  if (value === null) return schemaAllowsNull(schema) ? null : undefined;

  if (schemaType(schema) === "array") {
    const style = parameter?.style ?? (parameter?.in === "query" ? "form" : "simple");
    const explode = parameter?.explode ?? (style === "form");
    let values;

    if (Array.isArray(value)) {
      values = value;
    } else {
      const text = String(value).trim();
      if (style === "spaceDelimited") values = text.split(/\s+/).filter(Boolean);
      else if (style === "pipeDelimited") values = text.split("|").map(item => item.trim()).filter(Boolean);
      else if (style === "form" && explode && parameter?.in === "query" && !/comma separated/i.test(parameter?.description ?? "")) values = [text];
      else values = text.split(",").map(item => item.trim()).filter(Boolean);
    }
    if (schema.minItems !== undefined && values.length < schema.minItems) throw new TypeError("Parameter has fewer items than minItems.");
    if (schema.maxItems !== undefined && values.length > schema.maxItems) throw new TypeError("Parameter has more items than maxItems.");
    return values.map(item => coerceScalar(item, schema?.items ?? {}));
  }

  if (schemaType(schema) === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Parameter must be an object.");
    }
    const properties = schema.properties ?? {};
    const result = { ...value };
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (result[name] !== undefined) result[name] = coerceParameter(result[name], propertySchema);
    }
    for (const name of schema.required ?? []) {
      if (result[name] === undefined) throw new TypeError("Missing required object property: " + name);
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(result)) {
        if (!(name in properties)) throw new TypeError("Unexpected object property: " + name);
      }
    }
    return result;
  }

  return coerceScalar(value, schema);
}

function serializeQueryParameter(parameter, value) {
  const style = parameter?.style ?? "form";
  const explode = parameter?.explode ?? (style === "form");

  if (Array.isArray(value)) {
    if (style === "spaceDelimited") return value.join(" ");
    if (style === "pipeDelimited") return value.join("|");
    if (style === "form" && (explode === false || /comma separated/i.test(parameter?.description ?? ""))) {
      return value.join(",");
    }
    return value;
  }

  if (value && typeof value === "object") {
    if (style === "deepObject") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        parameter.name + "[" + key + "]",
        Array.isArray(item) ? item.join(",") : item,
      ]));
    }
    if (style === "form" && explode) return value;
    return Object.entries(value).flat().join(",");
  }

  return value;
}

function serializePathParameter(parameter, value) {
  const style = parameter?.style ?? "simple";
  if (Array.isArray(value)) {
    if (style === "label") return "." + value.join(".");
    if (style === "matrix") return ";" + parameter.name + "=" + value.join(",");
    return value.join(",");
  }
  if (value && typeof value === "object") {
    const pairs = Object.entries(value);
    if (style === "label") return "." + pairs.map(([key, item]) => key + "=" + item).join(",");
    if (style === "matrix") return ";" + pairs.map(([key, item]) => key + "=" + item).join(",");
    return pairs.map(([key, item]) => key + "," + item).join(",");
  }
  return String(value);
}

function mediaTypeMatches(available, requested) {
  if (!available || !requested) return false;
  const normalize = value => String(value).split(";", 1)[0].trim().toLowerCase();
  const [availableType, availableSubtype = "*"] = normalize(available).split("/", 2);
  const [requestedType, requestedSubtype = "*"] = normalize(requested).split("/", 2);

  const subtypeMatches = (left, right) => {
    if (left === "*" || right === "*" || left === right) return true;
    if (left.startsWith("*+") && right.endsWith(left.slice(1))) return true;
    if (right.startsWith("*+") && left.endsWith(right.slice(1))) return true;
    return false;
  };

  return (availableType === "*" || requestedType === "*" || availableType === requestedType)
    && subtypeMatches(availableSubtype, requestedSubtype);
}

function selectRequestMediaType(operation, values) {
  const available = requestBodyInfo(operation.requestBody, operation?._contract);
  if (!available.length) return null;
  const requested = values.__contentType;
  if (!requested) return available[0].mediaType;
  const selected = available.find(item => mediaTypeMatches(item.mediaType, requested));
  if (!selected) throw new TypeError(`Unsupported request content type: ${requested}`);
  return selected.mediaType;
}

function isJsonMediaType(mediaType) {
  return /(^|[/+])json($|[;+])|\+json$/i.test(String(mediaType ?? ""));
}

function validateRequestBody(value, schema, path = "$") {
  if (!schema || value === undefined) return;
  if (value === null) {
    if (schemaAllowsNull(schema)) return;
    throw new TypeError(`Invalid request body at ${path}: null is not allowed.`);
  }

  if (schema.oneOf?.length) {
    const matches = schema.oneOf.filter(variant => {
      try {
        validateRequestBody(value, variant, path);
        return true;
      } catch {
        return false;
      }
    });
    if (matches.length !== 1) {
      throw new TypeError(`Invalid request body at ${path}: oneOf requires exactly one matching schema.`);
    }
  }

  if (schema.anyOf?.length) {
    const matches = schema.anyOf.filter(variant => {
      try {
        validateRequestBody(value, variant, path);
        return true;
      } catch {
        return false;
      }
    });
    if (matches.length === 0) {
      throw new TypeError(`Invalid request body at ${path}: no anyOf schema matched.`);
    }
  }

  if (schema.allOf?.length) {
    for (const variant of schema.allOf) validateRequestBody(value, variant, path);
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    throw new TypeError(`Invalid request body at ${path}: value does not match const.`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.some(item => deepEqual(item, value))) {
    throw new TypeError(`Invalid request body at ${path}: value is not in enum.`);
  }

  const type = schemaType(schema);
  if (type === "object") {
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`Invalid request body at ${path}: expected an object.`);
    }
    const properties = schema.properties ?? {};
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      throw new TypeError(`Invalid request body at ${path}: fewer than minProperties.`);
    }
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) {
      throw new TypeError(`Invalid request body at ${path}: more than maxProperties.`);
    }
    for (const name of schema.required ?? []) {
      if (value[name] === undefined) {
        throw new TypeError(`Invalid request body at ${path}: missing required property ${name}.`);
      }
    }
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (value[name] !== undefined) validateRequestBody(value[name], propertySchema, `${path}.${name}`);
    }
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        if (!(name in properties)) throw new TypeError(`Invalid request body at ${path}: unexpected property ${name}.`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const name of Object.keys(value)) {
        if (!(name in properties)) validateRequestBody(value[name], schema.additionalProperties, `${path}.${name}`);
      }
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) throw new TypeError(`Invalid request body at ${path}: expected an array.`);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new TypeError(`Invalid request body at ${path}: fewer than minItems.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new TypeError(`Invalid request body at ${path}: more than maxItems.`);
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i += 1) {
        for (let j = i + 1; j < value.length; j += 1) {
          if (deepEqual(value[i], value[j])) throw new TypeError(`Invalid request body at ${path}: items must be unique.`);
        }
      }
    }
    for (let index = 0; index < value.length; index += 1) validateRequestBody(value[index], schema.items, `${path}[${index}]`);
  } else if (type === "integer" || type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || (type === "integer" && !Number.isInteger(value))) {
      throw new TypeError(`Invalid request body at ${path}: expected ${type}.`);
    }
    if (schema.minimum !== undefined && value < schema.minimum) throw new TypeError(`Invalid request body at ${path}: below minimum.`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new TypeError(`Invalid request body at ${path}: above maximum.`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) throw new TypeError(`Invalid request body at ${path}: at or below exclusiveMinimum.`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) throw new TypeError(`Invalid request body at ${path}: at or above exclusiveMaximum.`);
    if (schema.multipleOf !== undefined && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > Number.EPSILON * Math.max(1, Math.abs(value))) {
      throw new TypeError(`Invalid request body at ${path}: value is not a multipleOf constraint.`);
    }
  } else if (type === "boolean" && typeof value !== "boolean") {
    throw new TypeError(`Invalid request body at ${path}: expected boolean.`);
  } else if (type === "string") {
    if (typeof value !== "string") throw new TypeError(`Invalid request body at ${path}: expected string.`);
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new TypeError(`Invalid request body at ${path}: shorter than minLength.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new TypeError(`Invalid request body at ${path}: exceeds maxLength.`);
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern)).test(value)) {
      throw new TypeError(`Invalid request body at ${path}: does not match pattern.`);
    }
  }
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (typeof left === "object") {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}

export function buildRequest(operation, values = {}) {
  let path = operation.path;
  const query = {};

  for (const parameter of operation.parameters) {
    const schema = parameterSchema(parameter, operation?._contract);
    let value = values[parameter.name];
    if (value === undefined || value === "") {
      if (schema?.default !== undefined) value = schema.default;
      else {
        if (parameter.required) throw new TypeError(`Missing required parameter: ${parameter.name}`);
        continue;
      }
    }

    const coerced = coerceParameter(value, schema, parameter);

    if (parameter.in === "path") {
      path = path.replace(`{${parameter.name}}`, serializePathParameter(parameter, coerced));
    } else if (parameter.in === "query") {
      const serialized = serializeQueryParameter(parameter, coerced);
      if (serialized && typeof serialized === "object" && !Array.isArray(serialized)) {
        Object.assign(query, serialized);
      } else {
        query[parameter.name] = serialized;
      }
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
    } else if (isJsonMediaType(mediaType)) {
      try {
        body = JSON.parse(values.__body);
      } catch {
        throw new TypeError("Request body must contain valid JSON for the selected content type.");
      }
    } else {
      body = values.__body;
    }

    const content = operation.requestBody?.content?.[mediaType];
    if (content?.schema && (isJsonMediaType(mediaType) || typeof body !== "string")) {
      validateRequestBody(body, content.schema);
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
