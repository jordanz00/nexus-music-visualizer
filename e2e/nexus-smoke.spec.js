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
    /* GPU screen particles: init is deferred; overlay must patch before first frames. */
    await page.waitForFunction(
      function () {
        return !!(
          window.NX &&
          window.NX.particles &&
          window.NX.particles._ready &&
          window.NX.GpuParticles &&
          window.NX.GpuParticles.renderOverlay &&
          window.NX.GpuParticles.renderOverlay._nxMfxParticles
        );
      },
      null,
      { timeout: 20_000 }
    );
    const mixOn = await page.evaluate(function () {
      var m = document.getElementById('nx-mix-particles');
      var g = document.getElementById('nx-gpu-particles');
      return { mix: !m || m.checked, gpu: !g || g.checked };
    });
    expect(mixOn.mix, 'Mix tab particles master should be on (or control absent)').toBeTruthy();
    expect(mixOn.gpu, 'I/O GPU particles checkbox should be on (or control absent)').toBeTruthy();
  });
});
