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
  assert.equal(guard("Read", { file_path: join(project, "id.pem") }), "deny");
  assert.equal(guard("Read", { file_path: join(project, "environment.ts") }), "allow");
  assert.equal(guard("Write", { file_path: join(project, "node_modules", "x", "i.js") }), "deny");
  assert.equal(guard("Write", { file_path: code }), "allow");
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
