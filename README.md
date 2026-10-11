# 食光地圖 Food Map

台灣 22 縣市、368 鄉鎮市區餐廳推薦網站。GitHub + Cloudflare Workers，**不使用 D1 或任何自建資料庫**。

## 介面

首頁縣市選擇；全區或各鄉鎮市區；價位（不限／200 以內／200–400／400 以上）；用餐時段（不限／早餐／午餐／晚餐／消夜／點心）；料理種類（不限／中式／西式／日式／韓式／泰式／義式／燒烤／排餐／火鍋／小吃／素食／海鮮／咖啡／甜點）。

卡片只呈現餐廳名稱、縮圖、Google Maps 連結、1–99 推薦分及 50 字內特色。莫蘭迪色系、Noto Sans TC，手機優先，無 emoji 或箭頭。

## 交叉評估

1. Google Places API (New)：篩選查詢真實餐廳、價格資料、照片與 Maps 連結，排除已知歇業與區域不符店家。
2. LangSearch API：只對前六家候選餐廳搜尋獨立食記，過濾無法匹配店名、業配字詞以及同站重複內容。
3. Workers AI：有獨立評論時產生 50 字內特色；模型不可用時回退規則式摘要。
4. 推薦分數：Google 評分與評論量先經 Bayesian smoothing，再依可信的獨立來源數量及明確正負面詞有限加減。分數限於 1–99、規則固定，**不是 Google 官方分數或真實品質保證**。
5. 不建立資料庫，也不儲存 Google Places 內容或照片參照；每次查詢重新取得。

價位欄位若提供台幣 priceRange，使用範圍中點估計；否則參考 Google priceLevel 分類，**不是精準人均價格**。未知價位店家不納入指定價位帶的篩選。

## Cloudflare GitHub 部署

Cloudflare 控制台 → Workers & Pages → Create application → Import a repository → redfisharthur-beep/Food-map。

Worker 名稱必須為 food-map，與 wrangler.jsonc 一致。建置／部署命令使用 npx wrangler deploy。

接著在 Worker → Settings → Variables and Secrets 新增以下兩個 Secret：

- GOOGLE_PLACES_API_KEY：Google Cloud 上須啟用 Places API (New)、計費帳戶及安全配額。
- LANGSEARCH_API_KEY：LangSearch 的 Web Search API Key。

wrangler.jsonc 已設定 AI binding 為 AI。需有可用 Workers AI 用量才能產生 AI 摘要，否則退回規則式文案。

部署後可查 /api/health：google、langsearch 須為 true。Cloudflare Git Integration 設定完成後，推送 main 分支會自動部署。若希望本機發布，執行：

    npm install
    npx wrangler login
    npx wrangler secret put GOOGLE_PLACES_API_KEY
    npx wrangler secret put LANGSEARCH_API_KEY
    npm run deploy

不要把真正 API Key 放到 GitHub、前端程式、.env.example 或任何公開檔案。本專案已完成 GitHub 源碼，**不代表已完成 Cloudflare 帳戶的首次授權與金鑰設定**。

## 首頁圖檔與縣市點擊位置

上傳自己的首頁圖片到：

    public/assets/home.webp

圖片自動等比例顯示，沒有圖片就顯示莫蘭迪備用首頁。可自製圖示也放同一目錄。

若希望直接點擊首頁圖片上的縣市，請建立：

    public/assets/hotspots.json

示例內容：

    {
      "彰化縣": { "x": 44.5, "y": 47.2 },
      "台中市": { "x": 50.1, "y": 42.0 }
    }

座標是圖片尺寸的百分比，**以上數字僅示範格式而非準確位置**，上傳圖片後依實際縣市位置調整。沒有 hotspots.json 時使用圖片下方的 22 縣市文字按鈕。

## 檔案說明

- src/index.js：Google Places、LangSearch、Workers AI、照片與推薦評分 API。
- public/index.html：首頁與篩選結果版型。
- public/app.js：互動與餐廳卡片。
- public/styles.css：莫蘭迪響應式樣式。
- public/data/taiwan-districts.json：22 縣市與 368 鄉鎮市區。
- public/privacy.html、public/terms.html：基本隱私與使用條款。
- wrangler.jsonc：Workers 靜態資源與 AI 綁定。

## 品質與成本注意

每次篩選最多取得 20 筆 Google Places 候選，展示最多 14 筆，其中最多 6 筆執行 LangSearch 交叉搜尋。**這不是完整的全台餐廳排行榜**。

Google 搜尋、照片及 Workers AI 可能計費，請在 Google Cloud 設定每日請求上限，並在 Cloudflare 配置速率限制以減少濫用。

Google Places 搜尋結果不做持久化儲存，圖像遵循署名規則，並提供原始 Google Maps 連結及條款。餐廳只有少量網路證據時，特色文案會明白指出資料不足。

測試指令：

    npm run check
    npm test
