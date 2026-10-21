// SessionStart: in a project that already uses FlowDeck (~/.fd-plan/<slug>/ exists), inject the
// always_on rules and an index of the stage rules, so the context cost is paid only where it is used.
// shortcut: language detection is marker-file only (tsconfig/go.mod/Cargo.toml/pom/pyproject). upgrade: port upstream lazy-rule-loader.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot, planDir } from "../lib/paths.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
const cwd = projectRoot(input.cwd);
if (!existsSync(planDir(input.cwd))) process.exit(0);

const rulesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");
const split = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { meta: m[1], body: m[2] } : { meta: "", body: text };
};

const always = [];
const staged = [];
for (const dir of readdirSync(rulesDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of readdirSync(join(rulesDir, dir.name)).filter((n) => n.endsWith(".md"))) {
    const path = join(rulesDir, dir.name, f);
    const { meta, body } = split(readFileSync(path, "utf8"));
    if (/^always_on:\s*true/m.test(meta)) always.push(body.trim());
    else staged.push({ path, dir: dir.name });
  }
}

const markers = {
  typescript: ["tsconfig.json"],
  go: ["go.mod"],
  rust: ["Cargo.toml"],
  java: ["pom.xml", "build.gradle", "build.gradle.kts"],
  python: ["pyproject.toml", "requirements.txt", "setup.py"],
};
const langDir = { go: "golang" };
const detected = Object.keys(markers).filter((l) => markers[l].some((m) => existsSync(join(cwd, m))));
const wanted = new Set(["common", ...detected.map((l) => langDir[l] ?? l)]);
const index = staged.filter((s) => wanted.has(s.dir)).map((s) => `- ${s.path}`);

const text = [
  "# FlowDeck rules",
  ...always,
  "## Stage rules",
  "Read these before /flowdeck:fd-execute and /flowdeck:fd-verify write or check code:",
  ...index,
].join("\n\n");
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }));
