import { onRequest as __api_wc_gallery_likes_ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/wc/gallery/likes.ts"
import { onRequest as __api_wc_gallery_refresh_ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/wc/gallery/refresh.ts"
import { onRequest as __api_app_likes_ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/app/likes.ts"
import { onRequest as __api_app_vote_ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/app/vote.ts"
import { onRequest as __api_wc_gallery_index_ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/wc/gallery/index.ts"
import { onRequest as __api_wc__type__ts_onRequest } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/wc/[type].ts"
import { onRequestGet as __api_sync_ts_onRequestGet } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/sync.ts"
import { onRequestPost as __api_sync_ts_onRequestPost } from "/Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report/functions/api/sync.ts"

export const routes = [
    {
      routePath: "/api/wc/gallery/likes",
      mountPath: "/api/wc/gallery",
      method: "",
      middlewares: [],
      modules: [__api_wc_gallery_likes_ts_onRequest],
    },
  {
      routePath: "/api/wc/gallery/refresh",
      mountPath: "/api/wc/gallery",
      method: "",
      middlewares: [],
      modules: [__api_wc_gallery_refresh_ts_onRequest],
    },
  {
      routePath: "/api/app/likes",
      mountPath: "/api/app",
      method: "",
      middlewares: [],
      modules: [__api_app_likes_ts_onRequest],
    },
  {
      routePath: "/api/app/vote",
      mountPath: "/api/app",
      method: "",
      middlewares: [],
      modules: [__api_app_vote_ts_onRequest],
    },
  {
      routePath: "/api/wc/gallery",
      mountPath: "/api/wc/gallery",
      method: "",
      middlewares: [],
      modules: [__api_wc_gallery_index_ts_onRequest],
    },
  {
      routePath: "/api/wc/:type",
      mountPath: "/api/wc",
      method: "",
      middlewares: [],
      modules: [__api_wc__type__ts_onRequest],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_sync_ts_onRequestGet],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_ts_onRequestPost],
    },
  ]