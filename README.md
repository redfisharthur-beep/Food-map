# 食光地圖 Food Map

台灣 22 縣市、368 鄉鎮市區餐廳推薦網站。GitHub + Cloudflare Workers，**不使用 D1 或任何自建資料庫**。

## 介面

首頁只顯示使用者提供的 `map.webp`，沒有額外標題、文字及縣市按鈕；地圖上採透明 SVG 點擊區。進入縣市後提供全區或各鄉鎮市區；價位（不限／200 以內／200–400／400 以上）；用餐時段（不限／早餐／午餐／晚餐／消夜／點心）；料理種類（不限＋五大類：中式／小吃、日韓／亞洲、西式／排餐、鍋物／燒烤、咖啡／甜點）。

卡片呈現餐廳名稱、縮圖、Google Maps 連結、1–99 推薦分；有具體評論依據才顯示 50 字內特色，沒有有效內容就直接省略。莫蘭迪色系、Noto Sans TC，手機優先，無 emoji 或箭頭。

五大類由 `public/cuisine-categories.js` 共用前台標籤及後台搜尋字詞。每次切換仍只向 Google Places 發出**一次**文字搜尋請求，避免因合併選項提高 API 次數。Google 的合併類別搜尋屬於語意搜尋，不保證每個子類別都能平均出現；素食不再是獨立篩選項，可先使用「不限」搜尋。

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

    public/assets/map.webp

圖片在手機上維持等比例滿寬；在電腦上以可視高度為上限，置中完整顯示，旁邊使用同圖柔焦填色，不會為了填滿桌面而放大裁切。圖片與 SVG 熱區置於同一容器，縮放同步。首頁無額外文字、縣市按鈕或品牌列。

台灣本島共 19 個縣市的透明點擊區已在下列檔案描繪：

    public/assets/map-areas.json

每個點擊區均依目前 `map.webp` 的縮小預覽重新手工描繪，使用 850 × 1510 的預覽座標系統隨圖片一起縮放。點擊時較小的內嵌區域優先，邊界相距 12 像素內的小縫隙可容錯；滑鼠懸停不畫誤導性的縣市輪廓粗線。這張圖片沒有完整的法定行政界線；此圖層**只是依插畫輪廓的交互區域，不可用於正式行政地理判定**。目前圖片沒有描繪澎湖縣、金門縣、連江縣的縣域，所以沒有捏造三個離島的地圖熱區。若需要完整 22 縣市可點擊，需要在首頁圖加入相應離島區塊再描繪。


## 檔案說明

- src/index.js：Google Places、LangSearch、Workers AI、照片與推薦評分 API。
- public/index.html：首頁與篩選結果版型。
- public/app.js：SVG 地圖點擊與餐廳卡片。
- public/assets/map.webp：使用者製作的首頁地圖圖檔。
- public/assets/map-areas.json：19 個本島縣市透明 SVG 多邊形。
- public/styles.css：莫蘭迪響應式樣式。
- public/data/taiwan-districts.json：22 縣市與 368 鄉鎮市區。
- public/privacy.html、public/terms.html：基本隱私與使用條款。
- wrangler.jsonc：Workers 靜態資源與 AI 綁定。

## 品質與成本注意

每次篩選最多取得 20 筆 Google Places 候選，展示最多 14 筆，其中最多 6 筆執行 LangSearch 交叉搜尋。**這不是完整的全台餐廳排行榜**。

Google 搜尋、照片及 Workers AI 可能計費，請在 Google Cloud 設定每日請求上限，並在 Cloudflare 配置速率限制以減少濫用。

Google Places 搜尋結果不做持久化儲存，圖像遵循署名規則，並提供原始 Google Maps 連結及條款。餐廳缺乏可驗證且具體的網路評價時，特色欄會省略，避免重複顯示空泛文字。

測試指令：

    npm run check
    npm test
