import { createClient } from "@vercel/kv";
import type { VercelKV } from "@vercel/kv";

let client: VercelKV | null | undefined;

export function getKv(): VercelKV | null {
  if (client !== undefined) return client;

  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  if (!url || !token) {
    client = null;
    return client;
  }

  client = createClient({ url, token });
  return client;
}
