import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const matrix = JSON.parse(await readFile(new URL("../docs/api-capability-matrix.json", import.meta.url), "utf8"));
const inventory = JSON.parse(await readFile(new URL("../docs/api-openapi-inventory.json", import.meta.url), "utf8"));

test("capability matrix covers every inventoried operation", () => {
  const operations = matrix.operation_classifications ?? [];
  const inventoryOperations = inventory.operations ?? inventory.operation_inventory ?? [];

  assert.equal(operations.length, matrix.inventory.operation_count ?? 129);
  assert.equal(operations.length, inventoryOperations.length);

  const keys = operations.map(operation => String(operation.method).toUpperCase() + " " + operation.path);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(operations.every(operation => operation.operationId && operation.path && operation.method));
});

test("capability matrix uses only documented classification values", () => {
  const allowed = new Set(matrix.classifications);
  const allowedParameters = new Set(matrix.parameter_classifications);

  for (const operation of matrix.operation_classifications) {
    assert.ok(allowed.has(operation.classification), operation.path);
    for (const parameter of operation.parameters ?? []) {
      assert.ok(allowedParameters.has(parameter.classification), operation.path + "?" + parameter.name);
    }
  }
});

test("capability matrix classification counts reconcile with operation inventory", () => {
  const counts = {};
  for (const operation of matrix.operation_classifications) {
    counts[operation.classification] = (counts[operation.classification] ?? 0) + 1;
  }

  assert.deepEqual(counts, matrix.classification_counts);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), matrix.inventory.operation_count);
});
