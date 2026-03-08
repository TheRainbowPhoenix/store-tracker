import { Hono } from '@hono/hono';

const app = new Hono();
// Open the KV store. On Deno Deploy, this automatically connects to your managed KV instance.
const kv = await Deno.openKv();

// Helper to increment a stat safely using atomic operations
async function bumpStat(appId: string, statType: "views" | "downloads") {
  const key = ["apps", appId, statType];
  
  // Deno KV requires Deno.KvU64 for sum operations
  await kv.atomic()
    .mutate({
      type: "sum",
      key: key,
      value: new Deno.KvU64(1n), 
    })
    .commit();
}

// 1. Health/Root Route
app.get("/", (c) => c.text("ClassPadDev !! [ >v<]~ "));

// 2. Track a View
app.post("/view/:appId", async (c) => {
  const appId = c.req.param("appId");
  await bumpStat(appId, "views");
  return c.json({ success: true, message: `View incremented for ${appId}` });
});

// 3. Track a Download
app.post("/download/:appId", async (c) => {
  const appId = c.req.param("appId");
  await bumpStat(appId, "downloads");
  return c.json({ success: true, message: `Download incremented for ${appId}` });
});

// 4. Get Stats
app.get("/stats/:appId", async (c) => {
  const appId = c.req.param("appId");
  
  // Fetch both keys at the exact same time for efficiency
  const [viewsEntry, downloadsEntry] = await kv.getMany<[Deno.KvU64, Deno.KvU64]>([
    ["apps", appId, "views"],
    ["apps", appId, "downloads"]
  ]);

  // Extract the BigInt values and convert them to standard numbers
  const views = viewsEntry.value ? Number(viewsEntry.value.value) : 0;
  const downloads = downloadsEntry.value ? Number(downloadsEntry.value.value) : 0;

  return c.json({
    appId,
    views,
    downloads
  });
});

// Using the official Deno approach you found in the docs!
Deno.serve(app.fetch);