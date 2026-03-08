import { PrismaClient } from "./generated/prisma/client.ts";

const prisma = new PrismaClient();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Health check route
  if (req.method === "GET" && pathParts.length === 0) {
    return new Response("App Tracker API is running!", { status: 200 });
  }

  // Handle POST /view/:appId
  if (req.method === "POST" && pathParts[0] === "view" && pathParts[1]) {
    const appId = pathParts[1];
    try {
      const stats = await prisma.appStats.upsert({
        where: { appId },
        update: { views: { increment: 1 } },
        create: { appId, views: 1, downloads: 0 },
      });
      return Response.json({ success: true, stats });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Database error" }, { status: 500 });
    }
  }

  // Handle POST /download/:appId
  if (req.method === "POST" && pathParts[0] === "download" && pathParts[1]) {
    const appId = pathParts[1];
    try {
      const stats = await prisma.appStats.upsert({
        where: { appId },
        update: { downloads: { increment: 1 } },
        create: { appId, views: 0, downloads: 1 },
      });
      return Response.json({ success: true, stats });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Database error" }, { status: 500 });
    }
  }

  // Handle GET /stats/:appId
  if (req.method === "GET" && pathParts[0] === "stats" && pathParts[1]) {
    const appId = pathParts[1];
    const stats = await prisma.appStats.findUnique({ where: { appId } });
    
    if (!stats) {
      return Response.json({ error: "App not found" }, { status: 404 });
    }
    return Response.json(stats);
  }

  return new Response("Not found", { status: 404 });
});