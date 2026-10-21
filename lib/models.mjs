// Model per FlowDeck agent, from the model_profile and models settings. No agent ever runs above the main model.
//   inherit:   every agent on the main model
//   optimized (default): mapper and researcher on haiku, coder and tester on sonnet, the rest on main (all capped at main)
//   reduced:   every agent one step below main, haiku at the floor
// `models` ("coder=opus,mapper=haiku") overrides single agents, still capped at main.
export const LADDER = ["haiku", "sonnet", "opus", "fable"];
const ROLES = {
  mapper: "light", researcher: "light", coder: "build", tester: "build",
  architect: "judge", planner: "judge", reviewer: "judge", "debug-specialist": "judge", "security-auditor": "judge",
};
const OPTIMIZED = { light: "haiku", build: "sonnet" };

// main may be an alias ("opus") or a full id ("claude-opus-5-5")
export function modelsFor(main, profile, overrides = "") {
  const family = LADDER.find((m) => String(main).toLowerCase().includes(m));
  if (!family) throw new Error(`main model must name one of ${LADDER.join(", ")} (got ${JSON.stringify(main)})`);
  const top = LADDER.indexOf(family);
  const cap = (m) => LADDER[Math.min(LADDER.indexOf(m), top)];
  const pick = (role) =>
    profile === "reduced" ? LADDER[Math.max(top - 1, 0)] : profile === "optimized" && OPTIMIZED[role] ? cap(OPTIMIZED[role]) : family;
  const models = Object.fromEntries(Object.entries(ROLES).map(([agent, role]) => [agent, pick(role)]));
  const ignored = [];
  for (const pair of String(overrides).split(",").map((s) => s.trim()).filter(Boolean)) {
    const [agent, model] = pair.split("=").map((s) => s.trim().toLowerCase());
    if (agent in models && LADDER.includes(model)) models[agent] = cap(model);
    else ignored.push(pair);
  }
  return { models, ignored };
}
