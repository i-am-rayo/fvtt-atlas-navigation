import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("module manifest declares a v14 system-agnostic module shell", async () => {
  const manifest = await readJson("../module.json");
  const packageInfo = await readJson("../package.json");

  assert.equal(manifest.id, "fvtt-atlas-navigation");
  assert.equal(manifest.type, "module");
  assert.equal(manifest.version, packageInfo.version);
  assert.equal(manifest.compatibility.minimum, "14");
  assert.equal(manifest.compatibility.verified, undefined);
  assert.deepEqual(manifest.esmodules, ["scripts/main.js"]);
  assert.equal("system" in manifest, false);
  assert.equal("relationships" in manifest, false);
  assert.equal(
    manifest.manifest,
    "https://raw.githubusercontent.com/i-am-rayo/fvtt-atlas-navigation/refs/heads/feature/phase-2-atlas-setup/module.json"
  );
  assert.equal(
    manifest.download,
    "https://github.com/i-am-rayo/fvtt-atlas-navigation/archive/refs/heads/feature/phase-2-atlas-setup.zip"
  );
  assert.ok(manifest.manifest.endsWith("/module.json"));
  assert.ok(manifest.download.endsWith(".zip"));

  for (const path of manifest.esmodules) {
    await readFile(new URL("../" + path, import.meta.url));
  }
  for (const language of manifest.languages) {
    await readJson("../" + language.path);
  }
});

test("startup diagnostic registers during init and only notifies a GM", async () => {
  const language = await readJson("../lang/en.json");
  const events = new Map();
  const registrations = [];
  const menus = [];
  const notices = [];
  const originalHooks = globalThis.Hooks;
  const originalGame = globalThis.game;
  const originalUi = globalThis.ui;
  const originalFoundry = globalThis.foundry;

  try {
    globalThis.foundry = { applications: { api: { DialogV2: class {} } } };
    globalThis.Hooks = {
      once(name, callback) {
        assert.equal(events.has(name), false);
        events.set(name, callback);
      },
      on(name, callback) {
        assert.equal(events.has(name), false);
        events.set(name, callback);
      }
    };

    globalThis.game = {
      user: { isGM: false },
      i18n: { localize: (key) => language[key] ?? key },
      settings: {
        register: (...args) => registrations.push(args),
        registerMenu: (...args) => menus.push(args),
        get: (namespace, key) => {
          assert.equal(namespace, "fvtt-atlas-navigation");
          assert.equal(key, "showStartupNotice");
          return true;
        }
      }
    };
    globalThis.ui = {
      notifications: { info: (message) => notices.push(message) }
    };

    await import("../scripts/main.js");

    assert.equal(typeof events.get("init"), "function");
    assert.equal(typeof events.get("ready"), "function");
    events.get("init")();

    assert.equal(registrations.length, 1);
    const [namespace, key, options] = registrations[0];
    assert.equal(namespace, "fvtt-atlas-navigation");
    assert.equal(key, "showStartupNotice");
    assert.equal(options.scope, "world");
    assert.equal(options.config, true);
    assert.equal(options.type, Boolean);
    assert.equal(options.default, false);
    assert.ok(language[options.name]);
    assert.ok(language[options.hint]);

    // Per-Scene setup no longer belongs in the global module settings.
    assert.equal(menus.length, 0);
    assert.equal(typeof events.get("renderSceneConfig"), "function");

    events.get("ready")();
    assert.equal(notices.length, 0);

    globalThis.game.user.isGM = true;
    events.get("ready")();
    assert.deepEqual(notices, [language["FVTTATLAS.Notifications.Ready"]]);
  } finally {
    globalThis.Hooks = originalHooks;
    globalThis.game = originalGame;
    globalThis.ui = originalUi;
    globalThis.foundry = originalFoundry;
  }
});
