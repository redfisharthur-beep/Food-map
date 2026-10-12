// Shared labels and Google Places text queries for the five visible cuisine groups.
// Keep broad searches to one Places request per filter change to control API cost.
export const CUISINE_QUERIES = Object.freeze({
  "不限": "",
  "中式／小吃": "中式料理或台式小吃",
  "日韓／亞洲": "日式或韓式或泰式料理",
  "西式／排餐": "西式料理或義式料理或牛排",
  "鍋物／燒烤": "火鍋或燒烤或海鮮餐廳",
  "咖啡／甜點": "咖啡廳或甜點店"
});
export const CUISINE_LABELS = Object.freeze(Object.keys(CUISINE_QUERIES));
