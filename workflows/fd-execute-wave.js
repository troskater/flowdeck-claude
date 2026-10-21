export const meta = {
  name: 'fd-execute-wave',
  description: 'Run one FlowDeck plan wave: steps with disjoint files in parallel through flowdeck:coder, overlapping steps in order',
  whenToUse: 'Called by /flowdeck:fd-execute for a wave of two or more steps. args: {wave, steps: [{n, files, brief}]}; files come from the Steps section of plan.md',
  phases: [{ title: 'Guard', detail: 'batch steps by file overlap' }, { title: 'Implement', detail: 'one coder per step, batch by batch' }],
}

const RESULT = {
  type: 'object',
  properties: {
    files_changed: { type: 'array', items: { type: 'string' } },
    test_command: { type: 'string' },
    test_result: { type: 'string' },
    question: { type: 'string', description: 'Only when blocked and needing a decision. Omit this field entirely otherwise.' },
  },
  required: ['files_changed', 'test_result'],
}

const PARALLEL_NOTE = 'Other steps are editing different files at the same time. Run only the tests for your own files; the wave owner runs the full suite afterwards. Touch no file outside your step.'
const NO_QUESTION = /^(none|n\/a|no)\b/i

phase('Guard')
const steps = args.steps ?? []
const batches = []
const batchOf = []
steps.forEach((s, i) => {
  // a step goes after the last batch holding an earlier step that shares a file with it
  let idx = 0
  for (let j = 0; j < i; j++) {
    if (s.files.some(f => steps[j].files.includes(f))) idx = Math.max(idx, batchOf[j] + 1)
  }
  batchOf.push(idx)
  ;(batches[idx] ??= []).push(s)
})
const par = steps.filter((_, i) => batches[batchOf[i]].length > 1).length
log(`Parallel guard: ${par} parallel, ${steps.length - par} sequential, ${batches.length} batch(es)`)
batches.forEach((b, i) => log(`  batch ${i + 1}: ${b.map(s => 'Step ' + s.n).join(', ')}`))

phase('Implement')
const results = []
for (const [i, batch] of batches.entries()) {
  // shortcut: shared-checkout parallelism relies on the declared file lists; a test file two steps both create is not detected, upgrade to worktrees if that bites
  const note = batch.length > 1 ? `\n\n${PARALLEL_NOTE}` : ''
  const out = await parallel(batch.map(s => () =>
    agent(s.brief + note, { agentType: 'flowdeck:coder', schema: RESULT, label: `coder (step ${s.n})`, phase: 'Implement' })
      .then(r => r && { n: s.n, ...r })))
  for (const [k, r] of out.entries()) results.push(r ?? { n: batch[k].n, failed: true })
  if (out.some(r => !r || (r.question && !NO_QUESTION.test(r.question.trim())))) {
    log(`Stopping after batch ${i + 1}: a step returned a question or failed`)
    break
  }
}
return { batches: batches.map(b => b.map(s => s.n)), results }
