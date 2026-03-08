import { Hono } from '@hono/hono';
import { cors } from '@hono/hono/cors';

const app = new Hono();

// 2. Apply the CORS middleware to all routes ('*')
app.use(
  '*',
  cors({
    origin: [
      'https://classpad.dev',
      'https://store.classpad.dev',
      'https://classpaddev.github.io',
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow the methods you use
  })
);

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

// 2. Track a View (Standard API)
app.post("/view/:appId", async (c) => {
  const appId = c.req.param("appId");
  await bumpStat(appId, "views");
  return c.json({ success: true, message: `View incremented for ${appId}` });
});

// 3. Track a View (Tracking Pixel)
app.get("/pixel/view/:appId", async (c) => {
  const appId = c.req.param("appId");
  
  // Bump the stat
  await bumpStat(appId, "views");
  
  // Create a microscopic 1x1 transparent SVG
  const transparentSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
  
  // CRITICAL: Force the browser NOT to cache this image
  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  // Return the SVG
  return c.body(transparentSvg);
});

// 4. Track a Download
app.post("/download/:appId", async (c) => {
  const appId = c.req.param("appId");
  await bumpStat(appId, "downloads");
  return c.json({ success: true, message: `Download incremented for ${appId}` });
});

// 5. Get Stats
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