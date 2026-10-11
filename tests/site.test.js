import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../src/index.js";

test("Taiwan county and township selectors are complete", async () => {
  const counties = JSON.parse(await readFile(new URL("../public/data/taiwan-districts.json", import.meta.url), "utf8"));
  assert.equal(counties.length, 22);
  assert.equal(counties.reduce((total, county) => total + county.towns.length, 0), 368);
  assert(counties.find(x => x.name === "彰化縣").towns.includes("溪湖鎮"));
});

test("No API key is returned to the browser", async () => {
  const response = await worker.fetch(new Request("https://test.local/api/search?county=彰化縣"), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Google Places/);
});

test("Unknown county and invalid selection are blocked", async () => {
  const response = await worker.fetch(new Request("https://test.local/api/search?county=INVALID"), { GOOGLE_PLACES_API_KEY:"test" });
  assert.equal(response.status, 400);
});

test("Search applies county, town and price filters and returns a 1-99 score", async () => {
  const originalFetch = globalThis.fetch;
  const places = [
    {
      id:"valid123",displayName:{text:"溪湖好味小館"},formattedAddress:"彰化縣溪湖鎮員鹿路一段10號",
      rating:4.5,userRatingCount:400,businessStatus:"OPERATIONAL",
      priceLevel:"PRICE_LEVEL_INEXPENSIVE",types:["restaurant"],
      googleMapsUri:"https://maps.google.com/?cid=123"
    },
    {
      id:"other123",displayName:{text:"其他鄉鎮店"},formattedAddress:"彰化縣彰化市中山路1號",
      rating:5,userRatingCount:1,businessStatus:"OPERATIONAL",
      priceLevel:"PRICE_LEVEL_INEXPENSIVE",types:["restaurant"]
    }
  ];
  globalThis.fetch = async (url) => {
    assert.match(String(url), /places:searchText/);
    return new Response(JSON.stringify({ places }), { status:200, headers:{"Content-Type":"application/json"} });
  };
  try {
    const req = new Request("https://test.local/api/search?county=彰化縣&town=溪湖鎮&price=low&meal=不限&cuisine=不限");
    const response = await worker.fetch(req, { GOOGLE_PLACES_API_KEY:"fake", AI:null });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.count, 1);
    assert.equal(data.restaurants[0].name, "溪湖好味小館");
    assert(data.restaurants[0].score >= 1 && data.restaurants[0].score <= 99);
    assert(Array.from(data.restaurants[0].feature).length <= 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
