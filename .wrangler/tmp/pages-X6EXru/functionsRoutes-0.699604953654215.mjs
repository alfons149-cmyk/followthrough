import { onRequestOptions as __api_followups__id__ts_onRequestOptions } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\followups\\[id].ts"
import { onRequestPatch as __api_followups__id__ts_onRequestPatch } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\followups\\[id].ts"
import { onRequestGet as __api__debug_ts_onRequestGet } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\_debug.ts"
import { onRequestPost as __api__debug_ts_onRequestPost } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\_debug.ts"
import { onRequestOptions as __api_dev_index_ts_onRequestOptions } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\dev\\index.ts"
import { onRequestPost as __api_dev_index_ts_onRequestPost } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\dev\\index.ts"
import { onRequestGet as __api_followups_index_ts_onRequestGet } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\followups\\index.ts"
import { onRequestOptions as __api_followups_index_ts_onRequestOptions } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\followups\\index.ts"
import { onRequestPost as __api_followups_index_ts_onRequestPost } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\followups\\index.ts"
import { onRequestGet as __api_health_ts_onRequestGet } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\health.ts"
import { onRequestPost as __api_seed_ts_onRequestPost } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\seed.ts"
import { onRequestGet as __api_workspaces_ts_onRequestGet } from "C:\\Users\\Usuario\\followthrough-real\\followthrough\\functions\\api\\workspaces.ts"

export const routes = [
    {
      routePath: "/api/followups/:id",
      mountPath: "/api/followups",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_followups__id__ts_onRequestOptions],
    },
  {
      routePath: "/api/followups/:id",
      mountPath: "/api/followups",
      method: "PATCH",
      middlewares: [],
      modules: [__api_followups__id__ts_onRequestPatch],
    },
  {
      routePath: "/api/_debug",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api__debug_ts_onRequestGet],
    },
  {
      routePath: "/api/_debug",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api__debug_ts_onRequestPost],
    },
  {
      routePath: "/api/dev",
      mountPath: "/api/dev",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_dev_index_ts_onRequestOptions],
    },
  {
      routePath: "/api/dev",
      mountPath: "/api/dev",
      method: "POST",
      middlewares: [],
      modules: [__api_dev_index_ts_onRequestPost],
    },
  {
      routePath: "/api/followups",
      mountPath: "/api/followups",
      method: "GET",
      middlewares: [],
      modules: [__api_followups_index_ts_onRequestGet],
    },
  {
      routePath: "/api/followups",
      mountPath: "/api/followups",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_followups_index_ts_onRequestOptions],
    },
  {
      routePath: "/api/followups",
      mountPath: "/api/followups",
      method: "POST",
      middlewares: [],
      modules: [__api_followups_index_ts_onRequestPost],
    },
  {
      routePath: "/api/health",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_health_ts_onRequestGet],
    },
  {
      routePath: "/api/seed",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_seed_ts_onRequestPost],
    },
  {
      routePath: "/api/workspaces",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_workspaces_ts_onRequestGet],
    },
  ]