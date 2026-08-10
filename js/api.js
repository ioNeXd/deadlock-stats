
// Updated request
async function getLastUpdated() {
  const url = "https://api.deadlock-api.com/v1/matches/recently-fetched";
  const response = await fetch(url);
  const matches = await response.json();

  const latestTimestamp = matches[0].start_time; 
  const date = new Date(latestTimestamp * 1000); 
  return date;
}

// Heros requests
async function getHeroStats() {
  const url = "https://api.deadlock-api.com/v1/analytics/hero-stats";
  const response = await fetch(url);
  return await response.json();
}

async function getHeroesById() {
  const url = "https://api.deadlock-api.com/v1/assets/heroes";
  const response = await fetch(url);
  const heroes = await response.json();

  const heroesById = {};
  for (const hero of heroes) {
    heroesById[hero.id] = hero;
  }
  return heroesById;
}
// Items requests
async function getItemStats() {
  const url = "https://api.deadlock-api.com/v1/analytics/item-stats";
  const response = await fetch(url);
  return await response.json();
}

async function getItemsById() {
  const url = "https://api.deadlock-api.com/v1/assets/items";
  const response = await fetch(url);
  const items = await response.json(); 

  const itemsById = {};
  for (const item of items) {
    itemsById[item.id] = item;
  }
  return itemsById;
}
// Game stats request
async function getGameStats() {
  const url = "https://api.deadlock-api.com/v1/analytics/game-stats";
  const response = await fetch(url);
  return await response.json();
}