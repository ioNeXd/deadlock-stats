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

test("findHero resolves numeric ids and names", async () => {
  const { findHero } = await import("../src/services/inferno-test.js");
  const heroes = [
    { hero_id: 7, name: "Infernus", class_name: "hero_infernus" },
    { hero_id: 12, name: "Abrams", class_name: "hero_abrams" },
  ];

  assert.equal(findHero(heroes, "7")?.name, "Infernus");
  assert.equal(findHero(heroes, "hero_infernus")?.hero_id, 7);
  assert.equal(findHero(heroes, "Abrams")?.hero_id, 12);
});

test("collectHeroImageCandidates includes all hero-scoped item images without name filtering", async () => {
  const { collectHeroImageCandidates } = await import("../src/services/inferno-test.js");
  const result = collectHeroImageCandidates({
    hero: { hero_id: 7, name: "Infernus", images: {} },
    items: [{
      name: "Ability With Generic Class",
      images: { icon: "https://assets.deadlock-api.com/images/abilities/ability_7.png" },
    }],
  });

  assert.deepEqual(result.map(item => item.url), [
    "https://assets.deadlock-api.com/images/abilities/ability_7.png",
  ]);
});

test("collectHeroImageCandidates includes matching entries from the official image registry", async () => {
  const { collectHeroImageCandidates } = await import("../src/services/inferno-test.js");
  const result = collectHeroImageCandidates({
    hero: { hero_id: 7, name: "Infernus", class_name: "hero_infernus", images: {} },
    items: [],
    imageIndex: {
      heroes: {
        infernus_card: "https://assets.deadlock-api.com/images/heroes/infernus_card.webp",
        abrams_card: "https://assets.deadlock-api.com/images/heroes/abrams_card.webp",
      },
    },
  });

  assert.deepEqual(result.map(item => item.url), [
    "https://assets.deadlock-api.com/images/heroes/infernus_card.webp",
  ]);
});
