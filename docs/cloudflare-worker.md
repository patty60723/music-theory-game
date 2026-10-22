# Cloudflare Worker 練唱密碼鎖

此版本位於 `cloudflare` 專用分支。分支與自動部署設定見 [Cloudflare 分支說明](cloudflare-branch.md)。

一般樂理功能公開，練唱室透過同網域 Worker 驗證。密碼只在 Worker 的 Secret 中，前端沒有密碼或驗證雜湊。Worker 簽發 8 小時的 HttpOnly、Secure、SameSite=Strict Cookie；樂譜與四份 PDF 每次請求都必須通過驗證。登入每個 IP、每個 Cloudflare 位置每分鐘最多 5 次。

## 部署

1. 使用 Node.js 22 或更新版本，安裝 Wrangler：`npm install --save-dev wrangler`。
2. 執行 `npx wrangler login` 連結你的 Cloudflare 帳號。
3. 執行 `npx wrangler secret put PRACTICE_PASSWORD`，在互動提示輸入練唱專用密碼。
4. 執行 `npx wrangler secret put SESSION_SECRET`，輸入一組至少 32 字元的隨機字串，與密碼不同。可用密碼管理器產生。這是 Cookie 簽章金鑰。
5. 在 `cloudflare` 分支執行 `npm run deploy`。Wrangler 會先執行 `node scripts/build-worker.mjs`，再部署 Worker 與資源。
6. 目前指定網址為 `https://music-theory-game-api.awesome61004.workers.dev`。本設定會把網站一起部署到這個 Worker，直接開啟它練唱。需要自訂網域時，在這個 Worker 的 Domains & Routes 設定。

也能在 Cloudflare Dashboard → Workers & Pages → 你的 Worker → Settings → Variables and Secrets 新增上述兩個 **Secret**。不要使用一般 Text Variable，也不要把值填入 `wrangler.jsonc`。首次部署尚未設定 Secret 時，練唱 API 會回覆 503，不會放行。設定完成後重新載入即可。

格式如下，兩個值都使用純文字輸入，不加引號，不包 JSON，也不需要自己先算雜湊：

| Type | Variable name | Value |
| --- | --- | --- |
| Secret | `PRACTICE_PASSWORD` | 你選的練唱專用密碼 |
| Secret | `SESSION_SECRET` | 密碼管理器產生的至少 32 字元隨機字串，與密碼不同 |

`ASSETS` 與 `LOGIN_LIMITER` 是 Binding，由 `wrangler.jsonc` 在部署時設定，不能用一般 Variable 代替。Worker 程式在 `worker/index.mjs`；必須把靜態資源一起部署，僅在 Dashboard 貼上程式不會帶入網站與樂譜。使用 `npx wrangler deploy` 可完成這部分。請確認登入的是 `awesome61004` 所在 Cloudflare 帳號，避免部署到其他帳號。

Wrangler 開發時，把這兩個名稱放在本機 `.dev.vars`，再執行 `npx wrangler dev`；此檔案已排除 Git。測試也可以不安裝 Wrangler，直接使用下述 Node 測試介面。

## 私有資源與公開原始碼

`assets/` 保留本機樂譜 JSON 與四份 PDF，已排除 Git。建置只複製明確列出的公開程式與圖示，並把樂譜與 PDF 放進 `dist/private/finale/`。這些檔案只透過 Worker 的 ASSETS binding 讀取；`run_worker_first: true` 確保請求先經 Worker。

Git 自動建置使用 `private/finale-assets.enc.json` 加密包與獨立的建置 Secret `FINALE_ASSETS_KEY`；本機原稿與 `.private-assets.key` 都不提交。這讓公開儲存庫的 `cloudflare` 分支能獨立重建完整的 Worker。

Worker 只公開指定的程式路徑。直接請求 `/private/*`、`/assets/*`、原始碼、設定檔都回覆 404；登入後也只能從 `/api/finale/score` 與 `/api/finale/pdf/{f1,f2,m1,m2}` 取得練唱資料。不需要 R2、KV 或資料庫。

**不要把 `dist` 或 `assets` 發佈至 GitHub Pages 或其他公開檔案主機。** GitHub Pages 可繼續提供其他樂理功能；練唱室使用 Worker 網址，不設跨網域 Cookie 或 CORS。如果樂譜曾經進入公開 Git 歷史、舊部署或別人的下載檔案，這個鎖無法收回那些副本；目前本機 Git 沒有追蹤 `assets`。

其他公開功能維持離線可用。練唱資料標記 `private, no-store`，Service Worker 不快取登入 API、樂譜或 PDF，更新時刪除舊版快取。使用者成功登入後已取得的資料仍可能被自行儲存；本功能限制的是未授權的伺服器存取。

變更任一 Secret 會使既有 Cookie 失效。登出清除瀏覽器 Cookie 與目前頁面的樂譜；無資料庫的登入 Cookie 在到期／更換 Secret 前仍可能被重播。共用密碼適合這間練唱室；若未來需要個人帳號、逐人撤銷權限，可改接 Cloudflare Access。

## 驗證

```
node scripts/build-worker.mjs
node --test tests/worker.test.mjs
node tests/finale-player.test.cjs
```

瀏覽器測試使用 Playwright 與已安裝的 Microsoft Edge，會自動啟動同一份 Worker 程式的本機 HTTP 測試介面；測試密碼只存在測試環境，正式 Worker 不會使用它。設定 `CATSHARK_PLAYWRIGHT` 可指定外部安裝的模組。

實際 Cloudflare 部署前還需要你的帳號登入與上述 Secret，目前不會從聊天記錄自動設定正式密碼。

參考：[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Worker 靜態資源路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
