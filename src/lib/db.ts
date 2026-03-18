import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDatabase() {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }

  return env.DB;
}
