import assert from "node:assert/strict";
import test from "node:test";

import { collectInfernoImageCandidates } from "../src/services/inferno-test.js";

test("collectInfernoImageCandidates includes every image field returned for the hero", () => {
  const result = collectInfernoImageCandidates({
    hero: {
      hero_id: 1,
      name: "Infernus",
      images: {
        background_image: "https://assets.deadlock-api.com/images/heroes/infernus_background.png",
        hero_card_gloat_webp: "https://assets.deadlock-api.com/images/heroes/infernus_card_gloat.webp",
        weapon_image_webp: "https://assets.deadlock-api.com/images/heroes/infernus_gun.webp",
      },
    },
    items: [],
  });

  assert.deepEqual(result.map(item => item.url), [
    "https://assets.deadlock-api.com/images/heroes/infernus_background.png",
    "https://assets.deadlock-api.com/images/heroes/infernus_card_gloat.webp",
    "https://assets.deadlock-api.com/images/heroes/infernus_gun.webp",
  ]);
});

test("collectInfernoImageCandidates includes images from hero-scoped items", () => {
  const result = collectInfernoImageCandidates({
    hero: { name: "Infernus", images: {} },
    items: [{
      name: "Afterburn",
      images: { icon: "https://assets.deadlock-api.com/images/abilities/infernus_afterburn.png" },
    }],
  });

  assert.deepEqual(result.map(item => item.url), [
    "https://assets.deadlock-api.com/images/abilities/infernus_afterburn.png",
  ]);
});
