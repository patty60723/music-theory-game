---
version: alpha
name: 好玩就好 樂理好想吐
description: 繁體中文樂理與合唱練習工具，沿用劇場舞台與鋼琴視覺。
colors:
  background: "#110a0d"
  ink: "#f5eee2"
  muted: "#b2a38c"
  primary: "#d6ad5c"
  highlight: "#f4d994"
  velvet: "#560d1a"
typography:
  sans:
    fontFamily: '"Noto Sans TC", system-ui, sans-serif'
  serif:
    fontFamily: '"Noto Serif TC", serif'
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
spacing:
  page-max: "1280px"
  section-gap: "18px"
components:
  button: {}
  panel: {}
  piano: {}
  tabs: {}
---

# 好玩就好 Design System

## Overview

為使用手機或電腦的繁體中文樂理學習者與合唱排練者，提供可聽、可看、可反覆操作的練習工具。產品工具介面；使用者所在地不作推定。README.md 與目前功能需求是產品依據。

Creative North Star 是夜間劇場：酒紅舞台、金色控制器、真實鋼琴鍵。招牌是音符在琴鍵上的亮起，其他內容保持安靜、易讀。不新增行銷頁或儀表板風格。

Token ownership：既有 index.html 的 :root 與日間主題是 canonical runtime source；本文件記錄其意圖，不產生第二份 token。finale-player.css 直接引用 --ink、--gold、--line、--r-*、--c-* 等變數；scrollbar 的 --scroll-thumb／--scroll-track 分別引用 --muted／--bg2。

## Colors

深色背景、米白文字、金色強調延續既有網站。女1／女2／男1／男2 分別使用既有 --c-root、--c-third、--c-fifth、--c-seventh。同一琴鍵有多聲部時使用 --gold-hi 並列聲部名稱，不只用顏色表達。日間主題繼承既有 token 切換。Forced colors 保留系統色與可見外框。

## Typography

標題沿用 --display 與 --serif，控制器使用 --sans。繁體中文採既有 Noto／系統字型回退；數字時間採 tabular-nums。歌曲名稱與原始歌詞保留英文。

## Layout

Finale practice uses current/next lyrics without a previous line. Compact
landscape layouts reduce lyric spacing and the roll height to 100px. The
landscape view at least 700px wide places lyrics and piano side by
side, with the console below. A top
play/pause action mirrors the console, including loading and retry states.
Part cards own the playback register selector; male voices initially use
the lower octave, and displayed pitches always match sounding pitches.
Each part groups Mute, SOLO and Only mute this part in one equal-width row,
above the separate left/right routing row. Pressed states reflect the actual
mute configuration. Clicking an active preset restores all parts unmuted.
The compact tempo row keeps BPM increments and Return to original tempo
visible. Reset restores the score tempo map without seeking or changing
playback state. The four part cards immediately follow the common console.
The metronome stays visible in the common console. Other settings follow
the cards in two accessible tabs: singing settings and keyboard. Singing
settings contain the singing part, stereo swap, tempo slider, tap tempo
and master volume. Hidden settings retain values and keep functioning while
playing; changing these local tabs does not pause playback or change song.
During playback the piano viewport follows the active pitch range, including
nearby upcoming focus notes. If all parts cannot fit, the singing part takes
priority. Holding a manual piano key suspends following until release.
Following only scrolls the piano viewport, never the document.

頁面最大寬度 1280px，自然文件捲動。練唱頁的閱讀順序為動態歌詞、可彈奏鋼琴、精簡播放／速度控制台、四聲部混音、其他設定分頁。四聲部採兩欄卡片，720px 以下單欄。琴鍵區水平捲動，歌詞顯示目前句與下一句。播放與 BPM 控制保留至少 44px 觸控目標。

## Elevation & Depth

沿用 .panel 的半透明表面、細金邊與既有鋼琴陰影。歌詞區的聲部色條代表正在練唱的聲部；控制台直接嵌在鋼琴下方。

## Shapes

沿用 4／8／12／18px 與 pill；控制器不另立圓角系統。

## Components

既有 .play／.ghost／.panel／.tab 是主要 owner。四聲部控制器由 finale-player.js 管理，左右勾選是獨立原生 checkbox，練唱聲部使用既有 .seg 按鈕。Select/Listbox：其他既有工具維持原生 select，接受平台擁有的 popup；練唱速度改用 BPM 數字、加減按鈕與 range。Scrollbar：finale-player.css 提供全域 standards 與 WebKit fallback。

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native HTML select | DESIGN.md | Native OS popup | Browser selection and keyboard |
| Scrollbar | finale-player.css global selectors | index.html theme variables | Standard / forced-colors | Browser narrow layout and computed styles |

樂譜的拍點、音高與歌詞是聲音／視覺的共同資料來源；同步時鐘使用 AudioContext，切換分頁或進背景會暫停。載入失敗可重試，鋼琴仍可單獨彈奏。沿用 makePiano 的 interactive 變體，以原生 button 支援按住／放開、滑鼠、多指與鍵盤，其他舊琴鍵介面維持原行為。

每個聲部的靜音切換獨立於左右聲道與音量；靜音期間兩聲道增益皆為零，開啟後套用原設定。按鈕以文字與 aria-pressed 表達狀態。主唱歌詞不因靜音而消失，主唱琴鍵以 hollow 虛線提示，支援關掉自己的聲音練唱。手動彈奏獨立於歌曲聲部混音。

KTV 歌詞以句子為單位，保留跨音節的英文單字，不因連音重複歌詞。正在唱的字詞以掃色與金色底線標記，前後句較小；狀態不只靠顏色表達。練唱以樂譜為準，已移除 MP3 核對流程。

Motion：琴鍵與歌詞掃色反映演奏時間，無裝飾性動態。reduced-motion 用字詞實色與底線取代掃色，forced-colors 保留系統對比。另開分譜有 ↗ 提示。

## Do's and Don'ts

- Do：維持繁體中文操作詞彙與既有劇場視覺。
- Do：讓聲音、琴鍵、歌詞共用相同樂譜與播放時鐘。
- Don't：把 PDF 擷取宣稱為毫無錯誤的音符原檔。
- Don't：用固定全頁高度限制歌詞、鋼琴或下方控制台的操作。

## Singing rhythm and stereo focus

歌詞面板以橫向音符軌道呈現時值，音條長短對應拍數，高低對應音高；音條只標音名，延音線合成同一音條，休止留白。播放時音條經過固定播放線；減少動態模式採分頁軌道。軌道高度固定 240px，切換聲部與手機尺寸不造成版面高度跳動。全部歌詞以按鈕展開／收起，標出目前句，點句子可跳至該句；列表獨立捲動。
選擇練唱聲部時，預設該部在左、其餘在右；左右對調保留方向至下次選部。靜音與個別音量不變，手動修改聲道後顯示自訂狀態。整體音量滑桿控制樂譜與手彈鋼琴，預設 100%，可調 0–150%。
混音壓縮後提高 3 倍增益，再於整體音量控制後限幅；讓預設音量足夠練唱，合奏尖峰仍受控制。
節拍器選項放在控制台，預設關閉；四拍以數字與外框標示，第一拍重音。節拍音量獨立調整，仍受整體音量控制；節拍不跟隨聲部分流或靜音。開關、暫停、跳轉和變速均與樂譜同一時鐘同步，停止後不留殘餘排程。

## Practice room access

練唱室使用伺服器驗證。未登入只顯示密碼表單，錯誤與連線重試在原處呈現；密碼送出即清空欄位，送出時停用按鈕。驗證成功才取得樂譜並顯示歌詞、琴鍵、控制台。登出停止聲音並移除記憶體中的譜與連結。登入到期／斷線時鎖定練唱室；其他公開工具保持可用。私有樂譜與分譜不參與離線快取。
