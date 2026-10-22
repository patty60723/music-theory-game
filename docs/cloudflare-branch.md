# Cloudflare 專用分支

| 分支 | 內容 | 部署目的地 |
| --- | --- | --- |
| `main` | 原本公開的樂理遊戲 | GitHub Pages |
| `cloudflare` | 樂理工具、練唱室、密碼驗證與私有樂譜 | `music-theory-game-api.awesome61004.workers.dev` |

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
| Build secret `FINALE_ASSETS_KEY` | 本機 `.private-assets.key` 的整行內容，64 個十六進位字元 |

這裡是 **Builds 的 Variables and secrets**，與 Worker 執行時的 Secret 是不同設定。`PRACTICE_PASSWORD` 與 `SESSION_SECRET` 保留在原來的 Worker Secret，不需要移動或放進 Git。

複製建置金鑰到剪貼簿，可在此專案 PowerShell 執行（不會印出值）：

```powershell
Set-Clipboard -Value ((Get-Content -Raw -LiteralPath .private-assets.key).Trim())
```

`.private-assets.key` 已排除 Git，請另外存進密碼管理器。新電腦建置時可設定同名環境變數 `FINALE_ASSETS_KEY`。不要把它貼進程式、README、Issue 或聊天記錄。

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

## 修改樂譜

原始 JSON 與 PDF 放在本機 `assets/`，不進公開 Git。公開分支只存放 AES-256-GCM 加密包 `private/finale-assets.enc.json`。Cloudflare 建置時透過 `FINALE_ASSETS_KEY` 解開，再放入 Worker 保護的靜態資源。

修改樂譜或 PDF 後執行：

```sh
npm run assets:seal
npm test
git add private/finale-assets.enc.json
git commit -m "Update practice score"
git push origin cloudflare
```

只修改介面或 Worker 程式時，不必重新封裝樂譜。原始 PDF、樂譜、密碼與解密金鑰都不應提交。公開儲存庫可以解讀加密包的格式，但沒有建置金鑰就無法還原樂譜。

參考：[Cloudflare 分支控制](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)、[建置設定與 Secret](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。
