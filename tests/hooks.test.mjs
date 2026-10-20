// Run with: node --test tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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
