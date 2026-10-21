// FlowDeck settings are the plugin's userConfig options (plugin.json), edited in /config.
// Hooks receive them as CLAUDE_PLUGIN_OPTION_<KEY>; the Bash tool does not, so bin/fd-state reads the
// settings files Claude Code saves them in (pluginConfigs["flowdeck@<marketplace>"].options), local first.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULTS = { storage: "home", model_profile: "optimized", models: "", stage_skills: "" };

const STAGES = ["task", "review", "execute", "verify", "done"];
// "review=ponytail:ponytail-audit,verify=simplify" -> the skills for one stage, in order; bad entries are returned as ignored
export function stageSkills(stage, raw = "") {
  const want = String(stage).replace(/^fd-/, "");
  if (!STAGES.includes(want)) throw new Error(`stage must be one of ${STAGES.join(", ")} (got ${JSON.stringify(stage)})`);
  const skills = [];
  const ignored = [];
  for (const pair of String(raw).split(",").map((s) => s.trim()).filter(Boolean)) {
    const [s, skill = ""] = pair.split("=").map((x) => x.trim());
    const name = s.replace(/^fd-/, "");
    if (!STAGES.includes(name) || !/^[A-Za-z0-9][\w.-]*(:[\w.-]+)?$/.test(skill)) ignored.push(pair);
    else if (name === want && !skills.includes(skill)) skills.push(skill);
  }
  return { skills, ignored };
}

export function option(key, projectRoot) {
  const env = process.env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`];
  if (env) return env;
  const files = [join(projectRoot, ".claude", "settings.local.json"), join(projectRoot, ".claude", "settings.json"), join(homedir(), ".claude", "settings.json")];
  for (const file of files) {
    try {
      const configs = JSON.parse(readFileSync(file, "utf8")).pluginConfigs ?? {};
      const id = Object.keys(configs).find((k) => k.startsWith("flowdeck@"));
      const v = id && configs[id].options?.[key];
      if (v !== undefined && v !== null) return v;
    } catch {
      // missing or unreadable settings file: try the next one
    }
  }
  return DEFAULTS[key];
}
