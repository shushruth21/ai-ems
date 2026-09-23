import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Every client form submits through a server action, but until React has
 * hydrated the browser falls back to a plain HTML submit. Without `method`
 * that fallback is a GET, which puts whatever was typed — a password on the
 * sign-in form — into the URL, the history and the server's access log.
 *
 * This is a source check rather than a render test on purpose: it covers
 * every form in the app, including ones added later.
 */
const root = fileURLToPath(new URL("../../src", import.meta.url));

const FORM_WITH_ACTION = /<form\b[^>]*?onSubmit=\{[^}]+\}[^>]*?>/gs;

describe("client forms", () => {
  const files = globSync("**/*.tsx", { cwd: root }).map((relative) => ({
    relative,
    source: readFileSync(`${root}/${relative}`, "utf8"),
  }));

  it("finds the forms it is meant to be checking", () => {
    const withForms = files.filter((file) => FORM_WITH_ACTION.test(file.source));
    FORM_WITH_ACTION.lastIndex = 0;
    expect(withForms.length).toBeGreaterThan(5);
  });

  it("falls back to POST, so typed values never land in a URL", () => {
    const offenders: string[] = [];
    for (const { relative, source } of files) {
      for (const match of source.matchAll(FORM_WITH_ACTION)) {
        if (!match[0].includes('method="post"')) {
          offenders.push(`${relative}: ${match[0].split("\n")[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
