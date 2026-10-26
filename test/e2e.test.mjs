import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(root, "src");
const fixtures = path.join(root, "test", "fixtures");
const GECKO_ID = "rfc2119ify@patrickkettner.com";
const GECKO_UUID = "6f1d3c2a-2119-4c2a-9e1b-000000002119";

const SENTENCES = {
  upper: "MUST be set. A user agent MUST NOT fire. MAY be empty.",
  lower: "must be set. A user agent must not fire. may be empty.",
  prose: "Must be set. A user agent must not fire. May be empty.",
  alternating: "mUsT be set. A user agent mUsT nOt fire. mAy be empty.",
  off: "MUST be set. A user agent must not fire. may be empty.",
};

const browsers = {
  chrome: {
    launch: () =>
      puppeteer.launch({
        browser: "chrome",
        executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
        pipe: true,
        enableExtensions: true,
      }),
    optionsUrl: (id) => `chrome-extension://${id}/options.html`,
  },
  firefox: {
    launch: () =>
      puppeteer.launch({
        browser: "firefox",
        // Needed to open moz-extension:// pages.
        args: ["--remote-allow-system-access"],
        extraPrefsFirefox: { "extensions.webextensions.uuids": JSON.stringify({ [GECKO_ID]: GECKO_UUID }) },
      }),
    optionsUrl: () => `moz-extension://${GECKO_UUID}/options.html`,
  },
};

let server;
let origin;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      const body = await readFile(path.join(fixtures, path.basename(new URL(req.url, "http://x").pathname)));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const text = (page, selector) => page.$eval(selector, (el) => el.textContent);

async function waitForText(page, selector, expected) {
  try {
    await page.waitForFunction((s, e) => document.querySelector(s)?.textContent === e, { timeout: 5000 }, selector, expected);
  } catch {
    assert.equal(await text(page, selector), expected);
  }
}

for (const [name, setup] of Object.entries(browsers)) {
  describe(name, () => {
    let browser;
    let extensionId;

    before(async () => {
      browser = await setup.launch();
      extensionId = await browser.installExtension(extensionDir);
    });

    after(() => browser?.close());

    test("uppercases by default and leaves code, dates and other pages alone", async () => {
      const page = await browser.newPage();
      await page.goto(`${origin}/spec.html`);
      await waitForText(page, "#sentences", SENTENCES.upper);
      assert.equal(
        await text(page, "#boilerplate"),
        "The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119.",
      );
      assert.equal(await text(page, "#date"), "Editor’s Draft, 26 May 2026");
      assert.equal(await text(page, "#month"), "Published May 3, and you MAY read it.");
      assert.equal(
        await text(page, "#substrings"),
        "The mayor’s requirement was optionally mustard, shallow and recommendations.",
      );
      assert.equal(await text(page, "#code"), "The optional member is required.");
      assert.equal(await text(page, "#idl"), "required DOMString name;");

      await page.evaluate(() => {
        const p = document.createElement("p");
        p.id = "late";
        p.innerHTML = "Panels <b>should</b> work too.";
        document.body.append(p);
      });
      await waitForText(page, "#late", "Panels SHOULD work too.");

      const plain = await browser.newPage();
      await plain.goto(`${origin}/plain.html`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert.equal(await text(plain, "#sentences"), "Visitors must not feed the ducks.");
      await plain.close();
      await page.close();
    });

    test("the options page switches the mode on open pages and remembers it", async () => {
      const spec = await browser.newPage();
      await spec.goto(`${origin}/spec.html`);
      await waitForText(spec, "#sentences", SENTENCES.upper);

      const options = await browser.newPage();
      // Not awaited: Firefox never reports a moz-extension:// load as finished.
      options.goto(setup.optionsUrl(extensionId)).catch(() => {});
      await options.waitForSelector('input[value="upper"]:checked');

      for (const mode of ["lower", "prose", "alternating", "off", "upper", "prose"]) {
        await options.click(`input[value="${mode}"]`);
        await waitForText(spec, "#sentences", SENTENCES[mode]);
      }

      assert.equal(await text(spec, "#heading"), "2.10. Should response be blocked?");
      assert.equal(await text(spec, "#var"), "Run these steps. processBody must be called.");
      assert.equal(await text(spec, "#appendix"), "§ A.1 Optional features");
      assert.equal(await text(spec, "#abbrev"), "Some features, e.g. optional ones, are listed. Rules, i.e. must rules, apply.");
      assert.equal(await text(spec, "#note"), "Note: must be short.");
      assert.equal(await text(spec, "#letter"), "A must is a requirement.");
      assert.equal(await text(spec, "#quoted"), 'The string "." shall be used.');
      assert.equal(await text(spec, "#quotes"), "He said “must”. “May” too. It is done.) “Optional” starts here.");

      await spec.reload();
      await waitForText(spec, "#sentences", SENTENCES.prose);
      await options.close();
      await spec.close();
    });
  });
}
