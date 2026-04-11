// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('NEXUS smoke', () => {
  test('boot: splash, launch, no pageerror, transport visible', async ({ page }) => {
    const errors = [];
    page.on('pageerror', function (err) {
      errors.push(String(err && err.message ? err.message : err));
    });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#splash')).toBeVisible();
    await page.locator('#start-btn').click();
    await expect(page.locator('#splash')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#nextbtn')).toBeVisible();
    await page.locator('#nextbtn').click();
    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});
