import { assertEquals } from "@std/assert";
import app from "./main.ts";

Deno.test("Health route", async () => {
  const req = new Request("http://localhost/");
  const res = await app.request(req);
  assertEquals(res.status, 200);
});