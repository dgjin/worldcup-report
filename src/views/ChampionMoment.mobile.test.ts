import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

interface LayoutProbe {
  theme: "light" | "dark";
  viewportWidth: number;
  documentWidth: number;
  scorerText: string;
  scorer: { left: number; right: number };
  score: { left: number; right: number };
  hero: { left: number; right: number };
  ownGoalColor: string;
  ownGoalFontSize: string;
}

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));
function findChrome(): string {
  const executable = chromeCandidates.find(existsSync);
  if (!executable) throw new Error("A local Chrome/Chromium executable is required for the 375px layout regression");
  return executable;
}

const chrome = findChrome();

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue]
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgb(color: string): [number, number, number] {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  assert.ok(channels && channels.length === 3, `unsupported computed color: ${color}`);
  return channels as [number, number, number];
}

function contrastRatio(foreground: string, background: [number, number, number]): number {
  const foregroundLuminance = relativeLuminance(parseRgb(foreground));
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

async function reservePort(): Promise<number> {
  const socket = createNetServer();
  await new Promise<void>((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  assert.ok(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function captureProbe(url: string, profileDirectory: string): Promise<LayoutProbe> {
  const debuggingPort = await reservePort();
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1",
      "--hide-scrollbars",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-allow-origins=*",
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ]);
    let stderr = "";
    let webSocket: WebSocket | undefined;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Chrome layout probe timed out: ${stderr}`));
    }, 15_000);

    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);

    void (async () => {
      let endpoint: string | undefined;
      for (let attempt = 0; attempt < 100 && !endpoint; attempt += 1) {
        try {
          const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
            .then((response) => response.json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
          endpoint = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
        } catch {
          await new Promise((resume) => setTimeout(resume, 50));
        }
      }
      assert.ok(endpoint, `Chrome DevTools endpoint was unavailable: ${stderr}`);

      webSocket = new WebSocket(endpoint);
      await new Promise<void>((open, fail) => {
        webSocket!.addEventListener("open", () => open(), { once: true });
        webSocket!.addEventListener("error", () => fail(new Error("Chrome DevTools WebSocket failed")), { once: true });
      });

      let messageId = 0;
      const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void }>();
      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          id?: number;
          result?: Record<string, unknown>;
          error?: { message: string };
        };
        if (message.id === undefined) return;
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result ?? {});
      });
      const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((done, fail) => {
        const id = ++messageId;
        pending.set(id, { resolve: done, reject: fail });
        webSocket!.send(JSON.stringify({ id, method, params }));
      });

      await send("Page.enable");
      await send("Runtime.enable");
      await send("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 812,
        deviceScaleFactor: 1,
        mobile: true,
        screenWidth: 375,
        screenHeight: 812,
      });
      await send("Page.navigate", { url });

      let serializedProbe: string | undefined;
      for (let attempt = 0; attempt < 100 && !serializedProbe; attempt += 1) {
        const evaluation = await send("Runtime.evaluate", {
          expression: "document.querySelector('#probe-output')?.textContent || ''",
          returnByValue: true,
        });
        const runtimeResult = evaluation.result as { value?: unknown } | undefined;
        if (typeof runtimeResult?.value === "string" && runtimeResult.value) serializedProbe = runtimeResult.value;
        else await new Promise((resume) => setTimeout(resume, 50));
      }
      assert.ok(serializedProbe, "headless layout fixture must emit measurement JSON");
      clearTimeout(timeout);
      webSocket.close();
      child.kill("SIGKILL");
      resolve(JSON.parse(serializedProbe) as LayoutProbe);
    })().catch((error: unknown) => {
      clearTimeout(timeout);
      webSocket?.close();
      child.kill("SIGKILL");
      reject(error);
    });
  });
}

const server = await createServer({
  root: projectRoot,
  logLevel: "silent",
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
const profileDirectories = await Promise.all([
  mkdtemp(join(tmpdir(), "champion-mobile-dark-chrome-")),
  mkdtemp(join(tmpdir(), "champion-mobile-light-chrome-")),
]);

try {
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address === "object");
  const fixtureUrl = `http://127.0.0.1:${address.port}/src/views/ChampionMoment.mobile.fixture.html`;
  const [probe, lightProbe] = await Promise.all([
    captureProbe(`${fixtureUrl}?theme=dark`, profileDirectories[0]),
    captureProbe(`${fixtureUrl}?theme=light`, profileDirectories[1]),
  ]);
  const tolerance = 0.5;

  assert.equal(probe.viewportWidth, 375);
  assert.equal(probe.scorerText.includes("Nico Williams（乌龙）"), true);
  assert.ok(probe.documentWidth <= probe.viewportWidth, `document overflowed: ${JSON.stringify(probe)}`);
  assert.ok(probe.scorer.left >= probe.score.left - tolerance, `scorer escaped score card: ${JSON.stringify(probe)}`);
  assert.ok(probe.scorer.right <= probe.score.right + tolerance, `scorer escaped score card: ${JSON.stringify(probe)}`);
  assert.ok(probe.scorer.left >= probe.hero.left - tolerance, `scorer escaped hero: ${JSON.stringify(probe)}`);
  assert.ok(probe.scorer.right <= probe.hero.right + tolerance, `scorer escaped hero: ${JSON.stringify(probe)}`);

  const brightestCardRed: [number, number, number] = [170, 21, 27];
  for (const themeProbe of [probe, lightProbe]) {
    assert.ok(Number.parseFloat(themeProbe.ownGoalFontSize) >= 16, `${themeProbe.theme} own-goal text dropped below 16px`);
    const contrast = contrastRatio(themeProbe.ownGoalColor, brightestCardRed);
    assert.ok(contrast >= 4.5,
      `${themeProbe.theme} own-goal contrast ${contrast.toFixed(2)} is below 4.5:1 (${themeProbe.ownGoalColor})`);
  }
} finally {
  await server.close();
  await Promise.all(profileDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
}

console.log("ChampionMoment 375px layout regression passed");
