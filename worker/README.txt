拼經紀 YouTube 自動更新

網站更新（必要）
1. 將本次 pinkie-studio 資料夾的網站檔案上傳到你原本的網站。
2. CrazyFace 使用現有 Worker 的 ?handle=Crazyface。
3. 京野妮子使用現有 Worker 的 ?handle=niconini11369。
4. 現有 v5 已支援 handle 查詢，可直接沿用；不需要先修改 Worker。
5. API 成功時顯示最新三支影片；失敗時保留已確認的三支備用影片。
6. 影片回應沿用一小時快取；同次瀏覽也會重用已載入的影片資料。

Worker v6 更新（可選）
本資料夾的 pinkie-youtube-worker-v6.js 是完整的 Worker 程式。
可貼入 Cloudflare 的 pinkie-yt Worker 編輯器後部署。
沿用現有環境變數 YT_API_KEY，不需要把金鑰寫進程式或網站。
v6 加入 t11 CrazyFace、t12 京野妮子 Nico，並保留原有 t1 至 t10 對應。
v6 讓 talent 查詢與 handle 查詢共用一小時影片快取，並實作二十四小時頻道對應快取。

驗證範圍
已檢查 JavaScript 語法、兩位新人的 API 查詢參數、三支影片顯示、API 失敗處理、Worker 對應與快取。
尚未實測你的線上 API；這次沒有直接部署網站或 Worker。
