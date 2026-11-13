import { test, expect } from "@playwright/test";
import { expectNoOverflow } from "./helpers";

test("first entry requires a declaration; Yes persists and No exits or stays blocked", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("cinemax:prism-intro:v1", "1"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const declaration = page.getByRole("dialog", { name: "Are you 18 or older?" });
  await expect(declaration).toBeVisible();
  await expect(page.getByText("This is a self-declaration, not verified proof of age.", { exact: false })).toBeVisible();
  await expect(page.locator("#cinemax-app")).toBeHidden();
  await expectNoOverflow(page);
  await page.keyboard.press("Escape");
  await expect(declaration).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(declaration.getByRole("button", { name: "No", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(declaration.getByRole("button", { name: "Yes", exact: true })).toBeFocused();
  await declaration.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(declaration).toHaveCount(0);
  await expect(page.locator("main h1")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "Are you 18 or older?" })).toHaveCount(0);
  await expect(page.locator("main h1")).toBeVisible();

  await page.evaluate(() => {
    localStorage.removeItem("cinemaxxx:age-declaration:v1");
    sessionStorage.removeItem("cinemaxxx:age-declined-v1");
    // The module keeps a device-independent in-memory fallback, so use a new page below.
  });
  const second = await page.context().newPage();
  await second.addInitScript(() => {
    localStorage.removeItem("cinemaxxx:age-declaration:v1");
    sessionStorage.setItem("cinemax:prism-intro:v1", "1");
    Object.defineProperty(window, "close", { configurable: true, value: () => { document.documentElement.dataset.exitRequested = "true"; } });
  });
  await second.goto("/", { waitUntil: "domcontentloaded" });
  await second.getByRole("button", { name: "No", exact: true }).click();
  await expect(second.getByRole("dialog", { name: "Access blocked" })).toBeVisible();
  await expect(second.locator("#cinemax-app")).toBeHidden();
  await expect(second.locator("html")).toHaveAttribute("data-exit-requested", "true");
  await second.reload({ waitUntil: "domcontentloaded" });
  await expect(second.getByRole("dialog", { name: "Access blocked" })).toBeVisible();
  await second.close();
});

test("the Android bridge receives the No decision", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("cinemax:prism-intro:v1", "1");
    (window as typeof window & { CinemaxNative?: { exitApp: () => void } }).CinemaxNative = {
      exitApp: () => { document.documentElement.dataset.nativeExit = "true"; },
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-native-exit", "true");
  await expect(page.getByRole("dialog", { name: "Access blocked" })).toBeVisible();
});
