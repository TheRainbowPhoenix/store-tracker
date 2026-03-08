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

// 3.1. Track a Download (Icon Pixel)
app.get("/pixel/download/:appId", async (c) => {
  const appId = c.req.param("appId");
  
  // Bump the download stat
  await bumpStat(appId, "downloads");
  
  // The custom app/download icon you provided
  const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M14 22h-4c-3.771 0-5.657 0-6.828-1.172S2 17.771 2 14v-4c0-3.771 0-5.657 1.172-6.828S6.239 2 10.03 2c.606 0 1.091 0 1.5.017q-.02.12-.02.244l-.01 2.834c0 1.097 0 2.067.105 2.848c.114.847.375 1.694 1.067 2.386c.69.69 1.538.952 2.385 1.066c.781.105 1.751.105 2.848.105h4.052c.043.534.043 1.19.043 2.063V14c0 3.771 0 5.657-1.172 6.828S17.771 22 14 22" clip-rule="evenodd" opacity="0.5"/><path fill="currentColor" d="M10.56 15.498a.75.75 0 1 0-1.12-.996l-2.107 2.37l-.772-.87a.75.75 0 0 0-1.122.996l1.334 1.5a.75.75 0 0 0 1.12 0zm.95-13.238l-.01 2.835c0 1.097 0 2.066.105 2.848c.114.847.375 1.694 1.067 2.385c.69.691 1.538.953 2.385 1.067c.781.105 1.751.105 2.848.105h4.052q.02.232.028.5H22c0-.268 0-.402-.01-.56a5.3 5.3 0 0 0-.958-2.641c-.094-.128-.158-.204-.285-.357C19.954 7.494 18.91 6.312 18 5.5c-.81-.724-1.921-1.515-2.89-2.161c-.832-.556-1.248-.834-1.819-1.04a6 6 0 0 0-.506-.154c-.384-.095-.758-.128-1.285-.14z"/></svg>';
  
  // CRITICAL: Force the browser NOT to cache this image
  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  // Return the SVG
  return c.body(iconSvg);
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