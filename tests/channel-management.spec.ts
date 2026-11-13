import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { preparePage, expectNoOverflow, testAdminCredentials } from "./helpers";

test("studio category/channel CRUD, logo storage and public visibility", async ({ page }, info) => {
  test.setTimeout(120_000);
  const request = page.request; // Share the browser session, not a separate API cookie jar.
  await preparePage(page);
  const suffix = `${Date.now()}-${info.project.name}`;
  const name = `Browser verification ${suffix}`;
  const categoryIds: number[] = [];
  const channelIds: number[] = [];
  const login = await request.post("/api/admin/login", { data: testAdminCredentials() });
  expect(login.ok()).toBeTruthy();
  try {
    await page.goto("/gate-keeper/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "categories", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "categories", exact: true }).click();
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const categories = await (await request.get("/api/categories")).json();
    const category = categories.find((row: { name: string }) => row.name === name);
    expect(category).toBeTruthy(); categoryIds.push(category.id);
    await page.getByRole("button", { name: `Disable ${name}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Enable ${name}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Enable ${name}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Disable ${name}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "channels", exact: true }).click();
    await page.getByRole("button", { name: "+ Add", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Stream URL", { exact: true }).fill("https://example.invalid/live.m3u8");
    await page.getByLabel("Category", { exact: true }).selectOption(String(category.id));
    const bytes = await readFile("public/icon-192.png");
    await page.getByLabel("Channel logo", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: bytes });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible();
    const channels = await (await request.get("/api/admin/channels")).json();
    const channel = channels.find((row: { name: string }) => row.name === name);
    expect(channel).toBeTruthy(); channelIds.push(channel.id);
    expect(channel.logoUrl).toBeTruthy();
    const stored = await request.get(channel.logoUrl);
    expect((await stored.body()).equals(bytes)).toBeTruthy();
    await expectNoOverflow(page);
    await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(`${name} renamed`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name} renamed`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Disable ${name} renamed`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Enable ${name} renamed`, exact: true })).toBeVisible();
    expect((await (await request.get("/api/channels")).json()).some((row: { id: number }) => row.id === channel.id)).toBeFalsy();
    await page.getByRole("button", { name: `Enable ${name} renamed`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Disable ${name} renamed`, exact: true })).toBeVisible();
    await page.goto(`/category/${category.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: `Watch ${name} renamed`, exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await page.goto("/gate-keeper/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "channels", exact: true }).click();
    await page.getByRole("button", { name: `Edit ${name} renamed`, exact: true }).click();
    await page.getByRole("button", { name: "Remove logo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove logo", exact: true })).toHaveCount(0);
    expect((await (await request.get(`/api/admin/channels/${channel.id}`)).json()).logoUrl).toBeNull();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Delete ${name} renamed`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${name} renamed`, exact: true })).toHaveCount(0);
    channelIds.length = 0;
    await page.getByRole("button", { name: "categories", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    categoryIds.length = 0;
  } finally { await cleanup(request, categoryIds, channelIds); }
});

async function cleanup(request: APIRequestContext, categories: number[], channels: number[]) {
  for (const id of channels) await request.delete(`/api/admin/channels/${id}`);
  for (const id of categories) await request.delete(`/api/categories/${id}`);
}
