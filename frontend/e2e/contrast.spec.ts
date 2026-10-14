import { test, expect } from '@playwright/test';

/**
 * Hover-state contrast audit: hovers every visible control on the main pages
 * in light and dark themes and fails if text/icon contrast drops below 3:1
 * (WCAG non-text / large-text minimum). Guards against hard-coded hover
 * colors such as `hover:bg-black` on theme-inverted surfaces.
 */

const measureFn = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean); return [+r, +g, +b, +a]; };
  const blend = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    let acc = [255, 255, 255, 1];
    if (!layers.length || layers[layers.length - 1][3] < 1) acc = parse(getComputedStyle(document.body).backgroundColor) ?? acc;
    for (let i = layers.length - 1; i >= 0; i--) acc = blend(layers[i], acc);
    return acc;
  };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  return (el) => {
    const fg = parse(getComputedStyle(el).color); const bg = bgOf(el);
    const fgB = blend(fg, bg); const [L1, L2] = [lum(fgB), lum(bg)].sort((a, b) => b - a);
    return { ratio: (L1 + 0.05) / (L2 + 0.05), fg: getComputedStyle(el).color, bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})` };
  };
};


const PAGES: Array<[string, ((page: import('@playwright/test').Page) => Promise<void>) | null]> = [
  ['/', null],
  ['/dashboard', null],
  ['/board/1', async (page) => page.getByRole('button', { name: 'Open panel' }).click()],
  ['/board/1', async (page) => page.getByRole('button', { name: 'Open version history' }).click()],
  ['/board/1', async (page) => {
    await page.getByRole('button', { name: 'Show help' }).click();
    await page.getByRole('button', { name: /Replay tour/ }).click();
  }],
];

for (const theme of ['light', 'dark'] as const) {
  test(`hover states keep readable contrast (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    const res = await fetch('http://localhost:8000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'Password123!' }),
    });
    const { token, user } = (await res.json()).data;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(
      ({ token, session, theme }) => {
        localStorage.setItem('vb_token', token);
        localStorage.setItem('vb_user', JSON.stringify(session));
        localStorage.setItem('vb_onboarding_seen', 'true');
        localStorage.setItem('visualboard-theme', theme);
      },
      { token, session: user, theme },
    );

    const failures: string[] = [];
    let checked = 0;
    for (const [path, setup] of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(1000);
      if (setup) await setup(page);
      await page.waitForTimeout(300);
      for (const h of await page.$$('button:not([disabled]), a[href], [role="tab"]')) {
        const box = await h.boundingBox();
        if (!box || box.width < 6 || box.height < 6 || box.y < 0 || box.y > 900 || box.x > 1440) continue;
        const visible = await h.evaluate((el) => {
          const s = getComputedStyle(el);
          return s.visibility !== 'hidden' && +s.opacity > 0.2 && !el.closest('[aria-hidden="true"]');
        });
        if (!visible) continue;
        try {
          await h.hover({ timeout: 800 });
        } catch {
          continue;
        }
        await page.waitForTimeout(200);
        const r = await h.evaluate((el, src) => (0, eval)(src)()(el), `(${measureFn.toString()})`);
        checked++;
        if (r.ratio < 3) {
          const label = await h.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40));
          failures.push(`${path} "${label}" ${r.ratio.toFixed(2)}:1 (fg ${r.fg} on ${r.bg})`);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(failures, failures.join('\n')).toEqual([]);
  });
}
