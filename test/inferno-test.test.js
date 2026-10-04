import assert from "node:assert/strict";
import test from "node:test";

import { collectInfernoImageCandidates } from "../src/services/inferno-test.js";

test("collectInfernoImageCandidates includes official hero and ability image URLs and removes duplicates", () => {
  const result = collectInfernoImageCandidates({
    hero: {
      images: {
        card: "https://assets.deadlock-api.com/images/heroes/inferno_card.png",
        minimap: "https://assets.deadlock-api.com/images/heroes/inferno_mm.png",
      },
      abilities: {
        napalm: {
          image: "https://assets.deadlock-api.com/images/abilities/napalm.png",
        },
      },
    },
    imageRegistry: {
      hero_card: "https://assets.deadlock-api.com/images/heroes/inferno_card.png",
      unrelated: "https://assets.deadlock-api.com/images/heroes/haze_card.png",
    },
  });

  assert.deepEqual(result.map(item => item.url), [
    "https://assets.deadlock-api.com/images/abilities/napalm.png",
    "https://assets.deadlock-api.com/images/heroes/inferno_card.png",
    "https://assets.deadlock-api.com/images/heroes/inferno_mm.png",
  ]);
});
