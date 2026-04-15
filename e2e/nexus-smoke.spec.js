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
    /* GpuParticles overlay must patch (SwiftShader may not complete float FBO init → _ready false). */
    await page.waitForFunction(
      function () {
        return !!(
          window.NX &&
          window.NX.GpuParticles &&
          window.NX.GpuParticles.renderOverlay &&
          window.NX.GpuParticles.renderOverlay._nxParticula
        );
      },
      null,
      { timeout: 20_000 }
    );
    const nx = await page.evaluate(function () {
      return {
        hasParticles: !!(window.NX && window.NX.particles),
        ready: !!(window.NX && window.NX.particles && window.NX.particles._ready),
        hasParticulaHost: !!document.getElementById('nx-particula-host')
      };
    });
    expect(nx.hasParticulaHost, '#nx-particula-host layer present').toBeTruthy();
    expect(nx.hasParticles, 'NX.particles object').toBeTruthy();
    if (!nx.ready && typeof console !== 'undefined') {
      console.warn('[e2e] GPU particle sim not _ready (software GL / float FBO); overlay hook verified.');
    }
  });
});
