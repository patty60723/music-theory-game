# Cloudflare 專用分支

| 分支 | 內容 | 部署目的地 |
| --- | --- | --- |
| `main` | 原本公開的樂理遊戲 | GitHub Pages |
| `cloudflare` | 樂理工具、練唱室、密碼驗證程式 | `music-theory-game-api.awesome61004.workers.dev` |

兩個分支獨立修改。不要把 `cloudflare` 合併回 `main`；GitHub Pages 的發佈來源保持 `main`。需要共用的修正可以挑選個別 commit。建置與部署程式會拒絕 `cloudflare` 以外的分支，避免錯誤的建置設定覆蓋正式 Worker。

## 一次性連接 Cloudflare 自動部署

在 Cloudflare Dashboard → Workers & Pages → **music-theory-game-api** → Settings → **Builds**：

| 設定 | 值 |
| --- | --- |
| Git repository | `patty60723/music-theory-game` |
| Production branch | `cloudflare` |
| Root directory | `/`（儲存庫根目錄） |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Non-production / preview branch builds | **停用** |
| Build variable `NODE_VERSION` | `22` |
| 樂譜建置 Secret | 不需要；樂譜獨立存於私有 R2 |

`PRACTICE_PASSWORD` 與 `SESSION_SECRET` 保留在原來的 Worker Secret，不需要移動或放進 Git。之前加密包方案的 `FINALE_ASSETS_KEY` 不再使用，也不必設定。建置只讀取公開程式，不需要樂譜或 PDF。

Cloudflare 連接 GitHub 時可能要求你授權存取該儲存庫。完成並儲存上述設定後，第一次手動觸發 Build 確認成功；後續只要 push `cloudflare` 就會更新 Cloudflare。push `main` 不會觸發這個 Worker。若已經連接其他分支，請先把 production branch 改成 `cloudflare` 並停用其他分支的自動建置。

## 平常更新程式

```sh
git switch cloudflare
# 修改檔案後
npm test
git add <你修改的檔案>
git commit -m "Update singing practice"
git push origin cloudflare
```

若要手動部署，在這個分支執行 `npm ci` 後使用 `npm run deploy`。這與自動部署使用同一個分支檢查及建置流程。

## 首次設定私有 R2

1. 在 Cloudflare Dashboard → R2 Object Storage 完成首次啟用。選擇 **Standard** 儲存；帳務啟用流程由帳號擁有者確認。
2. 建立 `music-theory-game-private` bucket，保持 **Public access 停用**，不開啟 `r2.dev` 或公開自訂網域。
3. 本機切到 `cloudflare` 分支，保留 `assets/finale-score.json` 和四份 PDF，執行 `npm run assets:upload`。
4. 執行 `npm run deploy`，或提交更新的 `wrangler.jsonc` 並 push 觸發自動部署。設定中的 `SCORES` Binding 會把 Worker 連到此 bucket。

也可以用 CLI 建立 bucket：

```sh
npx wrangler r2 bucket create music-theory-game-private
```

原始 JSON 與 PDF 只存在本機 `assets/` 和私有 R2，不進公開 Git，也沒有加密包。R2 的檔案不隨程式部署而刪除或重傳。

## 修改樂譜與快取

修改本機樂譜或 PDF 後執行：

```sh
npm run assets:upload
git add wrangler.jsonc
git commit -m "Refresh private score cache version"
git push origin cloudflare
```

上傳工具在所有檔案成功上傳後，更新公開設定值 `SCORE_CACHE_VERSION`；它只有內容指紋，沒有樂譜資料。新版本部署後會使用新的快取鍵。程式沒有內建檔案寫入 API，讀取仍必須先登入。

Worker 使用 Cache API，共享同一個 Cloudflare 節點的樂譜／PDF 快取，最多一小時。只有未命中才讀 R2；不同節點、過期或淘汰後會各自重新讀取。每次請求先驗證登入，回傳瀏覽器的資料保持 `private, no-store`，不進離線快取。一次播放只載入一次樂譜 JSON，逐音播放不會發送 R2 請求。

手動從 Dashboard 上傳時，可先執行 `npm run assets:prepare`，把 `tmp/r2-upload/finale/` 的五個檔案上傳到 bucket 的 `finale/` 路徑；手動修改 `SCORE_CACHE_VERSION` 並部署，可立即切換快取。

參考：[Cloudflare 分支控制](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)、[私有 R2 Binding](https://developers.cloudflare.com/r2/get-started/workers-api/)、[Worker Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)。
