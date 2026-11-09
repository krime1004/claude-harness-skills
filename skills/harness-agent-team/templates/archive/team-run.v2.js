export const meta = {
  name: 'team-run',
  description: 'Agent team runs a backlog item: triage, per-slice design/implement/verify/complete, doc gardening, model retro',
  whenToUse: 'Run the agent team on docs/plans/active/<work>.md',
  phases: [
    { title: 'Triage', detail: 'PRD Maintainer splits the request into slices' },
    { title: 'Design', detail: 'implementer designs, red team reviews (only slices that need it)' },
    { title: 'Build', detail: 'implementer TDD build and fixes' },
    { title: 'Verify', detail: 'QA always, red team when assigned' },
    { title: 'Complete', detail: 'PRD Maintainer updates docs and commits' },
    { title: 'Garden', detail: 'doc-gardener tidies docs and archives the plan' },
    { title: 'Retro', detail: 'record metrics and apply the model adjustment' },
  ],
}
// team-run template v2

// args:
//   workFile, attribution            required
//   implementer, check               implementer role file name, check command
//   date                             YYYY-MM-DD for the run log (Date is unavailable in workflows)
//   modelState                       contents of .claude/workflows/team-models.json (null on first run)
//   userReportedBugs                 true when the user found bugs since the last run (raises QA)
const WORK = args.workFile
const ATTR = args.attribution
const IMPL = args.implementer || 'implementer'
const CHECK = args.check || 'scripts/check-all.sh'
const MAX_ROUNDS = 3

// ---- Model assignment --------------------------------------------------------------------
// Judgment steps (design, red team, retro) are fixed. The others adjust from run metrics:
// raise one tier on problems, lower one tier after clean significant runs, never below the floor.
const TIERS = ['haiku', 'sonnet', 'opus']
const DEFAULT_STEPS = {
  triage: { model: 'sonnet', floor: 'sonnet' },
  design: { model: 'opus', fixed: true },
  redTeam: { model: 'opus', effort: 'high', fixed: true },
  build: { model: 'opus', floor: 'sonnet' },
  fix: { model: 'opus', floor: 'sonnet' },
  qa: { model: 'sonnet', floor: 'sonnet' },
  complete: { model: 'sonnet', floor: 'sonnet' },
  park: { model: 'sonnet', floor: 'sonnet' },
  garden: { model: 'sonnet', effort: 'low', floor: 'haiku' },
  retro: { model: 'sonnet', effort: 'low', fixed: true },
}
// Problems within the last two runs that raise a step.
const RAISE_AT = { triage: 2, build: 1, fix: 1, qa: 2, complete: 1, park: 1, garden: 2 }
const CLEAN_TO_LOWER = 3
const CLEAN_TO_LOWER_AFTER_RAISE = 5

const freshStep = d => ({
  model: d.model, effort: d.effort || null, floor: d.floor || d.model, fixed: !!d.fixed,
  locked: false, cleanRuns: 0, raises: 0, autoLowerStopped: false, recent: [],
})
const state = { version: 2, steps: {} }
for (const [k, d] of Object.entries(DEFAULT_STEPS)) {
  const saved = args.modelState && args.modelState.steps && args.modelState.steps[k]
  state.steps[k] = { ...freshStep(d), ...(saved || {}) }
}
const use = step => {
  const s = state.steps[step]
  const o = {}
  if (s.model) o.model = s.model
  if (s.effort) o.effort = s.effort
  return o
}

const role = (file, name) =>
  `당신은 에이전트 팀의 ${name}입니다. 먼저 .claude/agents/${file}.md(역할 정의)와 docs/team/README.md를 읽고 그대로 따르세요. 작업 파일: ${WORK}. 결정이 필요하면 추천안을 고르고 작업 파일 "결정 로그"에 이유를 남기세요. 사람에게는 묻지 말고, 멈춰야 하는 경우에만 결과에 적으세요.`

const FINDING = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    location: { type: 'string' },
    problem: { type: 'string' },
    fix: { type: 'string' },
  },
  required: ['severity', 'location', 'problem', 'fix'],
}
const TRIAGE = {
  type: 'object',
  properties: {
    slices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          needsDesign: { type: 'boolean' },
          redTeam: { type: 'boolean' },
          blocked: { type: 'boolean' },
          blockReason: { type: 'string' },
        },
        required: ['id', 'title', 'needsDesign', 'redTeam', 'blocked'],
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['slices', 'questions'],
}
const WORK_RESULT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    blockReason: { type: 'string' },
  },
  required: ['status', 'summary'],
}
const VERDICT = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    evidence: { type: 'string' },
    findings: { type: 'array', items: FINDING },
  },
  required: ['pass', 'evidence', 'findings'],
}
const COMPLETE = {
  type: 'object',
  properties: {
    commit: { type: 'string' },
    summary: { type: 'string' },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['commit', 'summary', 'questions'],
}
const GARDEN = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    previousRunMisses: { type: 'boolean' },
    commit: { type: 'string' },
  },
  required: ['summary', 'previousRunMisses', 'commit'],
}
const RETRO = {
  type: 'object',
  properties: { commit: { type: 'string' }, summary: { type: 'string' } },
  required: ['commit', 'summary'],
}

const fmt = fs => fs.map(f => `- [${f.severity}] ${f.location}: ${f.problem} → ${f.fix}`).join('\n')
const report = { slices: [], questions: [] }
const metrics = { slices: [], commitFailed: { complete: false, park: false }, gardenPreviousMisses: false }

// ---- 1. Triage ---------------------------------------------------------------------------
phase('Triage')
const triage = await agent(
  `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 트리아지. 작업 파일의 요청을 1~4개 조각으로 나누고 작업 파일 "조각"에 체크박스로 적으세요. docs/prd/가 없으면 현재 기능 기준으로 짧게 만드세요(인덱스 README.md + 섹션 + history.md). current-state.md "다음 할 일"도 갱신하세요. 결과: 실행 순서대로 조각 목록과, 사람에게 꼭 물어야 할 질문(없으면 빈 배열).`,
  { ...use('triage'), label: 'prd-maintainer:triage', schema: TRIAGE },
)
if (!triage) return { error: 'triage failed' }
report.questions.push(...triage.questions)
log(`조각 ${triage.slices.length}개: ${triage.slices.map(s => s.id).join(', ')}`)

for (const slice of triage.slices) {
  const tag = `${slice.id}`
  const entry = { id: slice.id, title: slice.title, status: 'pending' }
  const m = {
    id: slice.id, needsDesign: slice.needsDesign, redTeam: slice.redTeam, blocked: false,
    designRounds: 0, verifyRounds: 0, rejectedBy: { qa: 0, redTeam: 0 }, qaPassRedFail: 0,
  }
  report.slices.push(entry)
  metrics.slices.push(m)
  if (slice.blocked) {
    entry.status = 'blocked'
    entry.reason = slice.blockReason
    m.blocked = true
    continue
  }
  const impl = `${role(IMPL, '구현자')}\n\n담당 조각: ${slice.id} — ${slice.title} (작업 파일의 정의를 따르세요).`

  // ---- 2. Design (+ red team review) -----------------------------------------------------
  if (slice.needsDesign) {
    phase('Design')
    let feedback = ''
    let agreed = false
    for (let round = 1; round <= MAX_ROUNDS && !agreed; round++) {
      m.designRounds = round
      const d = await agent(
        `${impl}\n\n지금 할 일: 설계만(코드 작성 금지). docs/design/에 결정과 이유를 적고 docs/design/README.md 인덱스에 추가하세요.${feedback ? `\n\n레드팀 지적(반영하거나, 반영하지 않으면 설계 문서에 이유를 적으세요):\n${feedback}` : ''}`,
        { ...use('design'), label: `implementer:design:${tag}:r${round}`, phase: 'Design', schema: WORK_RESULT },
      )
      if (!d || d.status === 'blocked') {
        entry.status = 'blocked'
        entry.reason = d ? d.blockReason : 'design agent failed'
        break
      }
      if (!slice.redTeam) { agreed = true; break }
      const r = await agent(
        `${role('red-team', '레드팀')}\n\n지금 할 일: 조각 ${slice.id}의 설계 검토. 설계 문서와 작업 파일의 조각 정의를 보세요. 구현 전에 고쳐야 할 결함만 findings에 적고, 없으면 pass=true.`,
        { ...use('redTeam'), label: `red-team:design:${tag}:r${round}`, phase: 'Design', schema: VERDICT },
      )
      if (!r || r.pass) { agreed = true; break }
      feedback = fmt(r.findings)
    }
    if (entry.status === 'blocked') { m.blocked = true; continue }
    if (!agreed) {
      entry.status = 'blocked'
      entry.reason = `설계 합의 ${MAX_ROUNDS}회 실패:\n${feedback}`
      m.blocked = true
      continue
    }
  }

  // ---- 3. Build + 4. Verify loop ---------------------------------------------------------
  phase('Build')
  let built = await agent(
    `${impl}\n\n지금 할 일: TDD로 구현하고 ${CHECK}를 통과시키세요. 작업 파일 "진행 기록"에 남기세요. 커밋은 하지 마세요.`,
    { ...use('build'), label: `implementer:build:${tag}`, phase: 'Build', schema: WORK_RESULT },
  )
  let passed = false
  let lastFindings = ''
  for (let round = 1; round <= MAX_ROUNDS && built && built.status === 'done'; round++) {
    m.verifyRounds = round
    const checks = [() => agent(
      `${role('qa-reviewer', 'QA/리뷰어')}\n\n지금 할 일: 조각 ${slice.id} 검증(커밋 전 git diff 기준). 구현자 보고: ${built.summary}`,
      { ...use('qa'), label: `qa:${tag}:r${round}`, phase: 'Verify', schema: VERDICT },
    )]
    if (slice.redTeam) checks.push(() => agent(
      `${role('red-team', '레드팀')}\n\n지금 할 일: 조각 ${slice.id} 구현 검증(커밋 전 git diff 기준). 재현 가능한 결함만 findings에 적으세요.`,
      { ...use('redTeam'), label: `red-team:verify:${tag}:r${round}`, phase: 'Verify', schema: VERDICT },
    ))
    const [qa, red] = await parallel(checks)
    if (qa && !qa.pass) m.rejectedBy.qa++
    if (red && !red.pass) m.rejectedBy.redTeam++
    if (qa && qa.pass && red && !red.pass) m.qaPassRedFail++
    const verdicts = [qa, red].filter(Boolean)
    const failing = verdicts.filter(v => !v.pass)
    if (verdicts.length && !failing.length) { passed = true; break }
    lastFindings = fmt(failing.flatMap(v => v.findings))
    if (round === MAX_ROUNDS) break
    built = await agent(
      `${impl}\n\n지금 할 일: 검증에서 반려된 항목을 고치세요(테스트 먼저). ${CHECK}를 통과시키고, 커밋은 하지 마세요.\n\n반려 사항:\n${lastFindings}`,
      { ...use('fix'), label: `implementer:fix:${tag}:r${round}`, phase: 'Build', schema: WORK_RESULT },
    )
  }

  // ---- 5. Complete (or park the slice) ---------------------------------------------------
  phase('Complete')
  if (passed) {
    const c = await agent(
      `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 조각 ${slice.id} 완료 처리. 체크박스 [x], docs/prd 갱신, history.md, current-state.md, lineage.md 갱신 후 ${CHECK} 통과를 확인하고 커밋하세요(push 금지). 커밋하지 못했으면 commit을 빈 문자열로 두세요. 커밋 메시지 끝에 다음 줄을 그대로 붙이세요:\n${ATTR}`,
      { ...use('complete'), label: `prd-maintainer:complete:${tag}`, phase: 'Complete', schema: COMPLETE },
    )
    entry.status = 'done'
    if (!c || !c.commit) metrics.commitFailed.complete = true
    if (c) { entry.commit = c.commit; entry.summary = c.summary; report.questions.push(...c.questions) }
  } else {
    entry.status = 'blocked'
    m.blocked = true
    entry.reason = built && built.status === 'blocked'
      ? built.blockReason
      : `검증 ${MAX_ROUNDS}회 실패:\n${lastFindings}`
    const c = await agent(
      `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 조각 ${slice.id}를 보류 처리. 작업 트리의 이 조각 변경을 \`git stash push -u -m "blocked ${slice.id}"\`로 보관해 다음 조각이 깨끗한 상태에서 시작하게 하고, 작업 파일에 보류 사유와 stash 이름을, current-state.md "대기 중인 질문"에 사람에게 물을 질문을 적은 뒤 문서만 커밋하세요(push 금지). 커밋하지 못했으면 commit을 빈 문자열로 두세요. 커밋 메시지 끝에:\n${ATTR}\n\n보류 사유:\n${entry.reason}`,
      { ...use('park'), label: `prd-maintainer:park:${tag}`, phase: 'Complete', schema: COMPLETE },
    )
    if (!c || !c.commit) metrics.commitFailed.park = true
    if (c) report.questions.push(...c.questions)
  }
}

// ---- 6. Garden ---------------------------------------------------------------------------
phase('Garden')
const g = await agent(
  `${role('doc-gardener', 'doc-gardener')}\n\n지금 할 일: 이번 작업 묶음 정리. 끝난 계획이면 done/으로 옮기세요. 이전 실행의 정리에서 빠진 것(문서-코드 불일치, 옮기지 않은 계획, 누락된 체크박스 등)을 이번에 발견했으면 previousRunMisses=true로 두세요. 커밋 메시지 끝에:\n${ATTR}\n결과로 바꾼 내용을 짧게 적으세요.`,
  { ...use('garden'), label: 'doc-gardener', phase: 'Garden', schema: GARDEN },
)
report.garden = g ? g.summary : null
metrics.gardenPreviousMisses = !!(g && g.previousRunMisses)

// ---- 7. Retro: deterministic model adjustment --------------------------------------------
// Each adjustable step gets one outcome for this run: 'problem', 'clean' or 'skip'.
// 'clean' counts only on significant runs where the step's problems could be observed.
const significant = metrics.slices.some(s => s.needsDesign) || metrics.slices.length >= 2
const anySlice = f => metrics.slices.some(f)
const qaObservable = anySlice(s => s.redTeam && s.verifyRounds > 0)
const outcomes = {
  triage: anySlice(s => s.designRounds >= 2 || s.blocked) ? 'problem' : 'clean',
  build: anySlice(s => s.verifyRounds >= 2) ? 'problem' : (anySlice(s => s.verifyRounds > 0) ? 'clean' : 'skip'),
  qa: (anySlice(s => s.qaPassRedFail > 0) || args.userReportedBugs) ? 'problem' : (qaObservable ? 'clean' : 'skip'),
  complete: metrics.commitFailed.complete ? 'problem' : (report.slices.some(s => s.status === 'done') ? 'clean' : 'skip'),
  park: metrics.commitFailed.park ? 'problem' : (report.slices.some(s => s.status === 'blocked') ? 'clean' : 'skip'),
  garden: metrics.gardenPreviousMisses ? 'problem' : 'clean',
}
outcomes.fix = outcomes.build
const changes = []
for (const [step, outcome] of Object.entries(outcomes)) {
  const s = state.steps[step]
  if (s.fixed || s.locked) continue
  s.recent = [...(s.recent || []), outcome].slice(-2)
  const tier = TIERS.indexOf(s.model)
  const problems = s.recent.filter(o => o === 'problem').length
  const raise = (problems >= RAISE_AT[step] || (step === 'qa' && args.userReportedBugs)) && outcome === 'problem'
  if (raise && tier < TIERS.length - 1) {
    const from = s.model
    s.model = TIERS[tier + 1]
    s.raises += 1
    s.cleanRuns = 0
    s.recent = []
    if (s.raises >= 2) s.autoLowerStopped = true
    changes.push({ step, from, to: s.model, direction: 'up', reason: `최근 2회 중 문제 ${problems}회` })
  } else if (outcome === 'problem') {
    s.cleanRuns = 0
  } else if (outcome === 'clean' && significant) {
    s.cleanRuns += 1
    const need = s.raises >= 1 ? CLEAN_TO_LOWER_AFTER_RAISE : CLEAN_TO_LOWER
    if (!s.autoLowerStopped && s.cleanRuns >= need && tier > TIERS.indexOf(s.floor)) {
      const from = s.model
      s.model = TIERS[tier - 1]
      s.cleanRuns = 0
      changes.push({ step, from, to: s.model, direction: 'down', reason: `센 실행 ${need}회 연속 문제 없음` })
    }
  }
}
metrics.significant = significant
metrics.outcomes = outcomes

phase('Retro')
const modelsUsed = Object.entries(DEFAULT_STEPS)
  .map(([k]) => `${k}=${(args.modelState && args.modelState.steps && args.modelState.steps[k] && args.modelState.steps[k].model) || DEFAULT_STEPS[k].model}`)
  .join(' ')
const sliceSummary = metrics.slices
  .map(s => `${s.id}: 설계 ${s.designRounds}·검증 ${s.verifyRounds}${s.rejectedBy.qa ? ` QA반려 ${s.rejectedBy.qa}` : ''}${s.rejectedBy.redTeam ? ` 레드팀반려 ${s.rejectedBy.redTeam}` : ''}${s.qaPassRedFail ? ` QA통과·레드팀반려 ${s.qaPassRedFail}` : ''}${s.blocked ? ' 보류' : ''}`)
  .join('; ')
const changeText = changes.length
  ? changes.map(c => `${c.step} ${c.from}→${c.to}(${c.reason})`).join(', ')
  : '없음'
const row = `| ${args.date || '-'} | ${WORK} | ${modelsUsed} | ${sliceSummary} | ${significant ? '예' : '아니요'} | ${changeText} | - | - |`
const retro = await agent(
  `당신은 에이전트 팀의 회고 기록자입니다. 판단하지 말고 아래 내용을 그대로 파일에 옮긴 뒤 커밋하세요.

1. .claude/workflows/team-models.json 파일 전체를 아래 JSON으로 덮어쓰세요(2칸 들여쓰기, 끝에 줄바꿈).
${JSON.stringify(state, null, 2)}

2. docs/team/run-log.md 표 맨 아래에 다음 한 줄을 추가하세요. 파일이 없으면 docs/team/README.md 형식에 맞춰 제목과 표 머리를 만든 뒤 추가하세요.
${row}

3. ${CHECK} 통과를 확인하고 이 두 파일만 커밋하세요(git commit -- <경로>, push 금지). 메시지는 "Record team run metrics and model assignment"이고, 끝에 다음 줄을 그대로 붙이세요:
${ATTR}

결과: 커밋 해시와 한 줄 요약. 커밋하지 못했으면 commit을 빈 문자열로 두세요.`,
  { ...use('retro'), label: 'retro', phase: 'Retro', schema: RETRO },
)

report.metrics = metrics
report.modelChanges = changes
report.modelState = state
report.retro = retro
return report
