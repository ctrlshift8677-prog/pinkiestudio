/**
 * 拼經紀 YouTube Latest Videos Worker — v6 (YouTube Data API v3)
 *
 * 環境變數：YT_API_KEY（沿用原有金鑰）
 * GET /?talent=t11 或 GET /?handle=Crazyface
 * GET /?talent=t12 或 GET /?handle=niconini11369
 *
 * 影片快取 1 小時，頻道與 uploads playlist 對應快取 24 小時。
 * 更新網站即可使用原 v5 的 handle 查詢；本檔是可選的 Worker 更新。
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const VIDEO_CACHE_TTL = 3600;
const CHANNEL_CACHE_TTL = 86400;

// 保留原有 ID；網站排序依藝人卡片排列。
const KOL_LIST = {
  t1:  { handle: "overloadtw",    name: "超負荷" },
  t2:  { handle: "goodson0706",   name: "乖兒子 GoodSon" },
  t3:  { handle: "luyee_1004",    name: "嚕乙 Luyee" },
  t4:  { handle: "rexderyt",      name: "雷克獅 Rex" },
  t5:  { handle: "kmomo0512",     name: "許摸摸 Kmomo" },
  t6:  { handle: "PpdbJ0320",     name: "佩佩豬伯爵 PpdbJ" },
  t7:  { handle: "a1chenb",       name: "小三登" },
  t8:  { handle: "XiaoLin1122",   name: "小霖 XiaoLin" },
  t9:  { handle: "WuWei",        name: "WuWei 無為" },
  t10: { handle: "otakumsvideo",  name: "肥宅MS" },
  t11: { handle: "Crazyface",     name: "CrazyFace" },
  t12: { handle: "niconini11369", name: "京野妮子 Nico" },
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return json({ error: "僅支援 GET 與 OPTIONS" }, 405, { Allow: "GET, OPTIONS" });
    }

    const apiKey = env.YT_API_KEY;
    if (!apiKey) {
      return json({
        error: "Worker 缺少 YT_API_KEY 環境變數，請沿用原有 YouTube Data API v3 金鑰",
      }, 500);
    }

    const url = new URL(request.url);
    const talent = url.searchParams.get("talent");
    let handle = url.searchParams.get("handle");
    if (talent && Object.prototype.hasOwnProperty.call(KOL_LIST, talent)) {
      handle = KOL_LIST[talent].handle;
    }
    handle = (handle || "").trim().replace(/^@/, "");
    if (!handle) {
      return json({
        error: "請提供 ?talent=tN 或 ?handle=xxx",
        available: Object.entries(KOL_LIST).map(([key, value]) => ({
          talent: key, handle: value.handle, name: value.name,
        })),
      }, 400);
    }

    try {
      const cache = caches.default;
      const cacheKey = makeCacheKey(url.origin, "videos", handle);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const channelInfo = await fetchChannelInfo(handle, apiKey, url.origin, ctx);
      if (!channelInfo) {
        return json({ error: `找不到 @${handle} 的頻道（YouTube Data API 回傳空結果）` }, 404);
      }
      const videos = await fetchPlaylistVideos(channelInfo.uploadsPlaylistId, 3, apiKey);
      const response = json({
        channelId: channelInfo.channelId,
        channelTitle: channelInfo.title,
        handle,
        videos,
        cachedAt: new Date().toISOString(),
      }, 200, { "Cache-Control": `public, max-age=${VIDEO_CACHE_TTL}` });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  },
};

function makeCacheKey(origin, kind, handle) {
  const key = new URL(`/__pinkie_yt_v6_cache/${kind}`, origin);
  key.searchParams.set("handle", handle.toLowerCase());
  return new Request(key.toString(), { method: "GET" });
}

async function fetchChannelInfo(handle, apiKey, origin, ctx) {
  const cache = caches.default;
  const cacheKey = makeCacheKey(origin, "channels", handle);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  apiUrl.searchParams.set("part", "snippet,contentDetails");
  apiUrl.searchParams.set("forHandle", `@${handle}`);
  apiUrl.searchParams.set("key", apiKey);

  const res = await fetch(apiUrl.toString());
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube API 錯誤 (channels): HTTP ${res.status} — ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  const channelInfo = {
    channelId: item.id,
    title: item.snippet.title,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
  const response = json(channelInfo, 200, {
    "Cache-Control": `public, max-age=${CHANNEL_CACHE_TTL}`,
  });
  ctx.waitUntil(cache.put(cacheKey, response));
  return channelInfo;
}

async function fetchPlaylistVideos(playlistId, maxResults, apiKey) {
  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  apiUrl.searchParams.set("part", "snippet");
  apiUrl.searchParams.set("playlistId", playlistId);
  apiUrl.searchParams.set("maxResults", String(maxResults));
  apiUrl.searchParams.set("key", apiKey);

  const res = await fetch(apiUrl.toString());
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube API 錯誤 (playlistItems): HTTP ${res.status} — ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.items) return [];

  return data.items.map(item => {
    const sn = item.snippet;
    const videoId = sn.resourceId?.videoId;
    const thumbnail =
      sn.thumbnails?.maxres?.url ||
      sn.thumbnails?.high?.url ||
      sn.thumbnails?.medium?.url ||
      sn.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      title: sn.title,
      published: sn.publishedAt,
      author: sn.channelTitle,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}
