# 延音核對室

網址：`https://music-theory-game-api.awesome61004.workers.dev/finale-review.html`

核對室沿用練唱密碼與 8 小時登入 cookie。正式練唱頁「其他設定」也有入口。頁面比較目前版本與候選修正版，正式 `finale/score.json` 不會因此改動。

選取段落後，按 A 或 B 播放同一時間範圍、同一聲部。可以調整 BPM、看原譜截圖及放大圖片，也可勾選整首比較；整首模式依聲部篩選選擇單聲部或四聲部。音色、音量處理與主頁共用，男聲同樣預設低八度。切換版本、段落或速度會停止先前的聲音。

每段可記錄「沒問題／需要調整」及備註。這些記錄只存於目前瀏覽器，依修正版雜湊隔開；更新核對資料後不會誤套舊記錄。按「複製核對結果」產生包含來源雜湊、修正版雜湊、段落 ID、判定與備註的 JSON，貼回對話即可。複製內容不含完整樂譜或圖片。

## 重新產生與發布

1. 保留未進版控的 `assets/finale-score.json` 與它引用的四份 PDF。
2. 使用已安裝 PyMuPDF、Pillow 的 Python 執行 `scripts/build-tie-review.py`。
3. 執行 `npm run build`、`npm test`、`node tests/finale-review.test.cjs`。瀏覽器測試使用 Playwright，可透過 `CATSHARK_PLAYWRIGHT` 指定套件路徑。
4. 在 `cloudflare` 分支執行 `node scripts/upload-tie-review.mjs`。只上傳私有 R2 物件 `finale/tie-review.json`，並更新 `TIE_REVIEW_CACHE_VERSION`；不會上傳正式樂譜與 PDF。
5. 發布程式及 `wrangler.jsonc` 後，Cloudflare 自動部署。

產生器依目前四份 PDF 的字型、音符與曲線座標比對延音線，包含跨行／跨頁的兩半曲線。這些幾何閾值針對目前譜面，不是通用 MusicXML/PDF 解析器。產生候選版時維持原本拍點、合併延音的起音、延續前音的臨時記號，並將歌詞起點移到延音鏈第一音。遇到互相衝突的明示歌詞會中止，避免猜測。

原始譜、候選版與原譜截圖一起放在未進版控的 `assets/finale-tie-review.json`。Worker 先驗證登入才讀取 R2／邊緣快取，回應使用 `private, no-store`；公開建置只包含空殼、共用音色與程式。核對完成後應另外審查正式譜更新，核對室不會自動套用使用者判定。
