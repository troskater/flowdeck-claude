// Run with: node --test tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = mkdtempSync(join(tmpdir(), "fd-home-"));
const project = mkdtempSync(join(tmpdir(), "fd-proj-"));
const slug = project.split(/[\\/]/).pop();
const planDir = join(home, ".fd-plan", slug);

const env = { ...process.env, HOME: home, USERPROFILE: home };
delete env.FLOWDECK_DEV_MODE;
delete env.CLAUDE_PROJECT_DIR;
for (const k of Object.keys(env)) if (k.startsWith("CLAUDE_PLUGIN_OPTION_")) delete env[k];

const hook = (name, payload) =>
  spawnSync("node", [join(root, "hooks", name)], { input: JSON.stringify({ cwd: project, ...payload }), env, encoding: "utf8" });
const gate = (file_path) => (hook("gatekeeper.mjs", { tool_name: "Write", tool_input: { file_path } }).stdout.includes('"deny"') ? "deny" : "allow");
const checkpoint = (current_command, current_stage) => {
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "checkpoint.json"), JSON.stringify({ current_command, current_stage }));
};
const code = join(project, "src", "main.ts");

test.after(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

test("gate: project with no FlowDeck state is never gated", () => {
  assert.equal(gate(code), "allow");
});

test("gate: active pipeline blocks code until EXECUTE or VERIFY", () => {
  checkpoint("fd-task", "in_progress");
  assert.equal(gate(code), "deny");
  checkpoint("fd-review", "complete");
  assert.equal(gate(code), "deny");
  checkpoint("fd-execute", "EXECUTE");
  assert.equal(gate(code), "allow");
  checkpoint("fd-verify", "VERIFY");
  assert.equal(gate(code), "allow");
  checkpoint("fd-verify", "failed");
  assert.equal(gate(code), "deny");
});

test("gate: closed or cancelled pipeline is not gated", () => {
  checkpoint("fd-done", "complete");
  assert.equal(gate(code), "allow");
  checkpoint("fd-task", "cancelled");
  assert.equal(gate(code), "allow");
});

test("gate: state files stay writable, but not via .. escape", () => {
  checkpoint("fd-task", "in_progress");
  assert.equal(gate(join(planDir, "topic", "plan.md")), "allow");
  assert.equal(gate(join(planDir, "..", "..", "evil.txt")), "deny");
});

test("gate: unreadable checkpoint fails closed", () => {
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "checkpoint.json"), "{not json");
  assert.equal(gate(code), "deny");
});

test("gate: a cd into a subfolder does not switch projects", () => {
  checkpoint("fd-task", "in_progress");
  const r = spawnSync("node", [join(root, "hooks", "gatekeeper.mjs")], {
    input: JSON.stringify({ cwd: join(project, "src"), tool_name: "Write", tool_input: { file_path: code } }),
    env: { ...env, CLAUDE_PROJECT_DIR: project },
    encoding: "utf8",
  });
  assert.match(r.stdout, /"deny"/);
});

test("fd-state: run from a subfolder of a git repo, writes the repo's state", () => {
  const repo = mkdtempSync(join(tmpdir(), "fd-repo-"));
  spawnSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "src"));
  const r = spawnSync("node", [join(root, "bin", "fd-state"), "path"], { cwd: join(repo, "src"), env, encoding: "utf8" });
  assert.equal(r.stdout.trim(), join(home, ".fd-plan", repo.split(/[\\/]/).pop()));
  rmSync(repo, { recursive: true, force: true });
});

test("gate: FLOWDECK_DEV_MODE=on bypasses", () => {
  checkpoint("fd-task", "in_progress");
  const r = spawnSync("node", [join(root, "hooks", "gatekeeper.mjs")], {
    input: JSON.stringify({ cwd: project, tool_name: "Write", tool_input: { file_path: code } }),
    env: { ...env, FLOWDECK_DEV_MODE: "on" },
    encoding: "utf8",
  });
  assert.equal(r.stdout, "");
});

const guard = (tool_name, tool_input) => (hook("tool-guard.mjs", { tool_name, tool_input }).stdout.includes('"deny"') ? "deny" : "allow");

test("tool-guard: inert outside a FlowDeck project, active inside", () => {
  rmSync(planDir, { recursive: true, force: true });
  assert.equal(guard("Bash", { command: "rm -rf build" }), "allow");
  mkdirSync(planDir, { recursive: true });
  assert.equal(guard("Bash", { command: "rm -rf build" }), "deny");
  assert.equal(guard("Bash", { command: "ls" }), "allow");
  assert.equal(guard("Read", { file_path: join(project, ".env") }), "deny");
  assert.equal(guard("Read", { file_path: join(project, ".env.local") }), "deny");
  assert.equal(guard("Read", { file_path: join(project, ".env.example") }), "allow");
  assert.equal(guard("Read", { file_path: join(project, "id.pem") }), "deny");
  assert.equal(guard("Read", { file_path: join(project, "environment.ts") }), "allow");
  assert.equal(guard("Write", { file_path: join(project, "node_modules", "x", "i.js") }), "deny");
  assert.equal(guard("Write", { file_path: code }), "allow");
});

test("tool-guard: CONSTRAINTS.md Forbidden Paths block edits", () => {
  mkdirSync(join(planDir, ".codebase"), { recursive: true });
  writeFileSync(join(planDir, ".codebase", "CONSTRAINTS.md"), "# C\n\n## Forbidden Paths\n- src/core/   # no direct edits\n- generated/\n\n## Other\n- src/ok/\n");
  assert.equal(guard("Edit", { file_path: join(project, "src", "core", "a.ts") }), "deny");
  assert.equal(guard("Write", { file_path: join(project, "generated", "x.ts") }), "deny");
  assert.equal(guard("Edit", { file_path: join(project, "src", "ok", "a.ts") }), "allow");
  assert.equal(guard("Read", { file_path: join(project, "src", "core", "a.ts") }), "allow");
});

test("autosave: stamps open pipelines, leaves closed ones alone", () => {
  const cp = join(planDir, "checkpoint.json");
  writeFileSync(cp, JSON.stringify({ current_command: "fd-execute", current_stage: "EXECUTE", saved_at: "old" }));
  hook("autosave.mjs", {});
  assert.notEqual(JSON.parse(readFileSync(cp, "utf8")).saved_at, "old");
  writeFileSync(cp, JSON.stringify({ current_command: "fd-done", current_stage: "complete", saved_at: "old" }));
  hook("autosave.mjs", {});
  assert.equal(JSON.parse(readFileSync(cp, "utf8")).saved_at, "old");
});

test("fd-gate: gate.json enabled=false turns off the gate and the tool guard", () => {
  mkdirSync(planDir, { recursive: true });
  checkpoint("fd-task", "in_progress");
  assert.equal(gate(code), "deny");
  assert.equal(guard("Bash", { command: "rm -rf x" }), "deny");
  const gj = join(planDir, "gate.json");
  writeFileSync(gj, JSON.stringify({ enabled: false }));
  assert.equal(gate(code), "allow");
  assert.equal(guard("Bash", { command: "rm -rf x" }), "allow");
  writeFileSync(gj, JSON.stringify({ enabled: true }));
  assert.equal(gate(code), "deny");
  assert.equal(guard("Bash", { command: "rm -rf x" }), "deny");
});

test("tool guard: rm -rf is blocked in command position only", () => {
  mkdirSync(planDir, { recursive: true });
  assert.equal(guard("Bash", { command: "cd x && rm -rf build" }), "deny");
  assert.equal(guard("Bash", { command: "ls; sudo rm -fr build" }), "deny");
  assert.equal(guard("Bash", { command: "rm -rfv build" }), "deny");
  assert.equal(guard("Bash", { command: "rm -Rf build" }), "deny");
  assert.equal(guard("Bash", { command: "rm -r build" }), "allow");
  assert.equal(guard("Bash", { command: "rm -f build.log" }), "allow");
  assert.equal(guard("Bash", { command: "echo 'rm -rf is blocked'" }), "allow");
  assert.equal(guard("Bash", { command: "git commit -m \"fix rm -rf false positive\"" }), "allow");
  assert.equal(guard("Bash", { command: "grep -rn \"rm -rf\" hooks" }), "allow");
});

const fdState = (slugName, ...args) =>
  spawnSync("node", [join(root, "bin", "fd-state"), ...args], { cwd: project, env: { ...env, FD_SLUG: slugName }, encoding: "utf8" });

test("fd-state: one write renders state.json, STATE.md and checkpoint.json", () => {
  const r = fdState("st-a", "set", "status=executing", "current_command=fd-execute", "current_stage=EXECUTE", "topic=t", "plan_confirmed=true", "steps_complete=0,1");
  assert.equal(r.status, 0, r.stderr);
  fdState("st-a", "set", "steps_complete+=2", "last_wave=1", "topic_branch=null");
  const dir = join(home, ".fd-plan", "st-a");
  const st = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.deepEqual(st.steps_complete, [0, 1, 2]);
  assert.equal(st.topic_branch, null);
  const cp = JSON.parse(readFileSync(join(dir, "checkpoint.json"), "utf8"));
  assert.equal(cp.current_stage, "EXECUTE");
  assert.equal(cp.last_wave, 1);
  assert.match(readFileSync(join(dir, "STATE.md"), "utf8"), /^steps_complete: 0,1,2$/m);
});

test("fd-state: rejects unknown keys and bad values without writing", () => {
  assert.notEqual(fdState("st-b", "set", "status=bogus").status, 0);
  assert.notEqual(fdState("st-b", "set", "nope=1").status, 0);
  assert.notEqual(fdState("st-b", "set", "plan_confirmed=maybe").status, 0);
  assert.notEqual(fdState("st-b", "set", "project=other").status, 0);
  assert.equal(fdState("st-b", "get").stdout.trim(), "{}");
});

test("fd-state: first write imports an existing STATE.md and checkpoint.json", () => {
  const dir = join(home, ".fd-plan", "st-c");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "STATE.md"), "status: executing\nplan_confirmed: true\ntopic: legacy\nsteps_complete: 0,1\n");
  writeFileSync(join(dir, "checkpoint.json"), JSON.stringify({ current_command: "fd-execute", current_stage: "EXECUTE", last_wave: 2 }));
  assert.equal(fdState("st-c", "set", "last_action=x").status, 0);
  const st = JSON.parse(fdState("st-c", "get").stdout);
  assert.equal(st.topic, "legacy");
  assert.deepEqual(st.steps_complete, [0, 1]);
  assert.equal(st.last_wave, 2);
  assert.equal(st.current_stage, "EXECUTE");
});

test("fd-state: a legacy value that no longer validates is skipped, not fatal", () => {
  const dir = join(home, ".fd-plan", "st-d");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "STATE.md"), "status: planning\ntopic: legacy\n");
  const r = fdState("st-d", "set", "last_action=x");
  assert.equal(r.status, 0, r.stderr);
  const st = JSON.parse(fdState("st-d", "get").stdout);
  assert.equal(st.topic, "legacy");
  assert.equal(st.status, undefined);
});

test("autosave: stamps saved_at in state.json too", () => {
  fdState(slug, "set", "current_command=fd-execute", "current_stage=EXECUTE");
  const before = JSON.parse(readFileSync(join(planDir, "state.json"), "utf8")).saved_at;
  const stale = new Date(0).toISOString();
  const st = JSON.parse(readFileSync(join(planDir, "state.json"), "utf8"));
  writeFileSync(join(planDir, "state.json"), JSON.stringify({ ...st, saved_at: stale }));
  hook("autosave.mjs", {});
  assert.notEqual(JSON.parse(readFileSync(join(planDir, "state.json"), "utf8")).saved_at, stale);
  assert.ok(before);
});

// Runs the workflow script with stub globals; agents just echo their step.
const runWave = (steps) => {
  const src = readFileSync(join(root, "workflows", "fd-execute-wave.js"), "utf8").replace("export const meta", "const meta");
  const run = new (Object.getPrototypeOf(async () => {}).constructor)("args", "phase", "log", "agent", "parallel", src);
  const parallel = (fns) => Promise.all(fns.map((f) => f()));
  const agent = async () => ({ files_changed: [], test_result: "pass" });
  return run({ steps }, () => {}, () => {}, agent, parallel);
};

test("wave: steps sharing a file run in order, the rest in parallel", async () => {
  const out = await runWave([
    { n: 1, files: ["src/a.ts"], brief: "" },
    { n: 2, files: ["src/b.ts"], brief: "" },
    { n: 3, files: ["./src/a.ts"], brief: "" },
  ]);
  assert.deepEqual(out.batches, [[1, 2], [3]]);
});

test("wave: a step with no file list runs alone", async () => {
  const out = await runWave([
    { n: 1, files: ["a"], brief: "" },
    { n: 2, brief: "" },
    { n: 3, files: ["b"], brief: "" },
  ]);
  assert.deepEqual(out.batches, [[1], [2], [3]]);
});

const models = (main, opts = {}) => {
  const extra = Object.fromEntries(Object.entries(opts).map(([k, v]) => [`CLAUDE_PLUGIN_OPTION_${k.toUpperCase()}`, v]));
  const r = spawnSync("node", [join(root, "bin", "fd-state"), "models", main], { cwd: project, env: { ...env, ...extra }, encoding: "utf8" });
  return { ...Object.fromEntries(r.stdout.trim().split(" ").map((p) => p.split("="))), stderr: r.stderr };
};

test("models: profiles, overrides, and the cap at the main model", () => {
  const def = models("claude-opus-5-5");
  assert.deepEqual([def.mapper, def.coder, def.reviewer], ["haiku", "sonnet", "opus"]);
  assert.equal(models("opus", { model_profile: "inherit" }).coder, "opus");
  const opt = models("opus", { model_profile: "optimized" });
  assert.deepEqual([opt.mapper, opt.coder, opt.reviewer], ["haiku", "sonnet", "opus"]);
  assert.equal(models("haiku", { model_profile: "optimized" }).coder, "haiku");
  const red = models("sonnet", { model_profile: "reduced" });
  assert.deepEqual([red.reviewer, red.coder], ["haiku", "haiku"]);
  const over = models("sonnet", { models: "coder=fable, mapper=haiku, bogus=x" });
  assert.deepEqual([over.coder, over.mapper], ["sonnet", "haiku"]);
  assert.match(over.stderr, /bogus=x/);
});

test("skills: a stage gets its configured skills in order, bad entries are ignored", () => {
  const skills = (stage, value) =>
    spawnSync("node", [join(root, "bin", "fd-state"), "skills", stage], { cwd: project, env: { ...env, CLAUDE_PLUGIN_OPTION_STAGE_SKILLS: value }, encoding: "utf8" });
  const value = "review=ponytail:ponytail-audit, fd-review=simplify, verify=simplify, plan=x, review=$(rm x)";
  const r = skills("fd-review", value);
  assert.equal(r.stdout.trim(), "ponytail:ponytail-audit\nsimplify");
  assert.match(r.stderr, /plan=x/);
  assert.match(r.stderr, /\$\(rm x\)/);
  assert.equal(skills("done", value).stdout, "");
  assert.notEqual(skills("bogus", value).status, 0);
});

test("storage=project: state lives in the project, ignores itself, and the gate follows it", () => {
  const settings = join(home, ".claude", "settings.json");
  mkdirSync(dirname(settings), { recursive: true });
  writeFileSync(settings, JSON.stringify({ pluginConfigs: { "flowdeck@flowdeck-marketplace": { options: { storage: "project" } } } }));
  const r = spawnSync("node", [join(root, "bin", "fd-state"), "set", "current_command=fd-task", "current_stage=in_progress"], { cwd: project, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const local = join(project, ".fd-plan");
  assert.equal(readFileSync(join(local, ".gitignore"), "utf8"), "*\n");
  assert.equal(JSON.parse(readFileSync(join(local, "checkpoint.json"), "utf8")).current_stage, "in_progress");
  assert.equal(gate(code), "deny");
  assert.equal(gate(join(local, "topic", "plan.md")), "allow");
  rmSync(settings);
  rmSync(local, { recursive: true, force: true });
});

test("version: plugin.json and marketplace.json agree", () => {
  const read = (f) => JSON.parse(readFileSync(join(root, ".claude-plugin", f), "utf8"));
  assert.equal(read("marketplace.json").plugins[0].version, read("plugin.json").version);
});

test("session-start: silent in a project FlowDeck has not touched", () => {
  rmSync(planDir, { recursive: true, force: true });
  assert.equal(hook("session-start.mjs", {}).stdout, "");
});

test("session-start: injects always_on rules and a language-matched stage index", () => {
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(project, "go.mod"), "module x\n");
  const out = JSON.parse(hook("session-start.mjs", {}).stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, "SessionStart");
  assert.match(out.additionalContext, /Behavioral Guidelines/);
  assert.match(out.additionalContext, /golang[\\/]patterns\.md/);
  assert.doesNotMatch(out.additionalContext, /python[\\/]patterns\.md/);
  assert.match(out.additionalContext, /common[\\/]testing\.md/);
});
