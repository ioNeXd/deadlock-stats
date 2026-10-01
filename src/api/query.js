export function queryToObject(query) {
  if (!(query instanceof URLSearchParams)) return query ?? {};

  const result = {};
  for (const [key, value] of query.entries()) {
    if (!(key in result)) {
      result[key] = value;
    } else if (Array.isArray(result[key])) {
      result[key].push(value);
    } else {
      result[key] = [result[key], value];
    }
  }
  return result;
}
