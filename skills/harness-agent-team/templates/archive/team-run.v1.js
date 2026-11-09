export const meta = {
  name: 'team-run',
  description: 'Agent team runs a backlog item: triage, per-slice design/implement/verify/complete, doc gardening',
  whenToUse: 'Run the agent team on docs/plans/active/<work>.md',
  phases: [
    { title: 'Triage', detail: 'PRD Maintainer splits the request into slices' },
    { title: 'Design', detail: 'implementer designs, red team reviews (only slices that need it)' },
    { title: 'Build', detail: 'implementer TDD build and fixes' },
    { title: 'Verify', detail: 'QA always, red team when assigned' },
    { title: 'Complete', detail: 'PRD Maintainer updates docs and commits' },
    { title: 'Garden', detail: 'doc-gardener tidies docs and archives the plan' },
  ],
}

const WORK = args.workFile
const ATTR = args.attribution
const IMPL = args.implementer || 'implementer'
const CHECK = args.check || 'scripts/check-all.sh'
const MAX_ROUNDS = 3

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

const fmt = fs => fs.map(f => `- [${f.severity}] ${f.location}: ${f.problem} → ${f.fix}`).join('\n')
const report = { slices: [], questions: [] }

phase('Triage')
const triage = await agent(
  `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 트리아지. 작업 파일의 요청을 1~4개 조각으로 나누고 작업 파일 "조각"에 체크박스로 적으세요. docs/prd/가 없으면 현재 기능 기준으로 짧게 만드세요(인덱스 README.md + 섹션 + history.md). current-state.md "다음 할 일"도 갱신하세요. 결과: 실행 순서대로 조각 목록과, 사람에게 꼭 물어야 할 질문(없으면 빈 배열).`,
  { label: 'prd-maintainer:triage', schema: TRIAGE },
)
if (!triage) return { error: 'triage failed' }
report.questions.push(...triage.questions)
log(`조각 ${triage.slices.length}개: ${triage.slices.map(s => s.id).join(', ')}`)

for (const slice of triage.slices) {
  const tag = `${slice.id}`
  const entry = { id: slice.id, title: slice.title, status: 'pending' }
  report.slices.push(entry)
  if (slice.blocked) {
    entry.status = 'blocked'
    entry.reason = slice.blockReason
    continue
  }
  const impl = `${role(IMPL, '구현자')}\n\n담당 조각: ${slice.id} — ${slice.title} (작업 파일의 정의를 따르세요).`

  if (slice.needsDesign) {
    phase('Design')
    let feedback = ''
    let agreed = false
    for (let round = 1; round <= MAX_ROUNDS && !agreed; round++) {
      const d = await agent(
        `${impl}\n\n지금 할 일: 설계만(코드 작성 금지). docs/design/에 결정과 이유를 적고 docs/design/README.md 인덱스에 추가하세요.${feedback ? `\n\n레드팀 지적(반영하거나, 반영하지 않으면 설계 문서에 이유를 적으세요):\n${feedback}` : ''}`,
        { label: `implementer:design:${tag}:r${round}`, phase: 'Design', schema: WORK_RESULT },
      )
      if (!d || d.status === 'blocked') {
        entry.status = 'blocked'
        entry.reason = d ? d.blockReason : 'design agent failed'
        break
      }
      if (!slice.redTeam) { agreed = true; break }
      const r = await agent(
        `${role('red-team', '레드팀')}\n\n지금 할 일: 조각 ${slice.id}의 설계 검토. 설계 문서와 작업 파일의 조각 정의를 보세요. 구현 전에 고쳐야 할 결함만 findings에 적고, 없으면 pass=true.`,
        { label: `red-team:design:${tag}:r${round}`, phase: 'Design', schema: VERDICT },
      )
      if (!r || r.pass) { agreed = true; break }
      feedback = fmt(r.findings)
    }
    if (entry.status === 'blocked') continue
    if (!agreed) {
      entry.status = 'blocked'
      entry.reason = `설계 합의 ${MAX_ROUNDS}회 실패:\n${feedback}`
      continue
    }
  }

  phase('Build')
  let built = await agent(
    `${impl}\n\n지금 할 일: TDD로 구현하고 ${CHECK}를 통과시키세요. 작업 파일 "진행 기록"에 남기세요. 커밋은 하지 마세요.`,
    { label: `implementer:build:${tag}`, phase: 'Build', schema: WORK_RESULT },
  )
  let passed = false
  let lastFindings = ''
  for (let round = 1; round <= MAX_ROUNDS && built && built.status === 'done'; round++) {
    const checks = [() => agent(
      `${role('qa-reviewer', 'QA/리뷰어')}\n\n지금 할 일: 조각 ${slice.id} 검증(커밋 전 git diff 기준). 구현자 보고: ${built.summary}`,
      { label: `qa:${tag}:r${round}`, phase: 'Verify', schema: VERDICT },
    )]
    if (slice.redTeam) checks.push(() => agent(
      `${role('red-team', '레드팀')}\n\n지금 할 일: 조각 ${slice.id} 구현 검증(커밋 전 git diff 기준). 재현 가능한 결함만 findings에 적으세요.`,
      { label: `red-team:verify:${tag}:r${round}`, phase: 'Verify', schema: VERDICT },
    ))
    const verdicts = (await parallel(checks)).filter(Boolean)
    const failing = verdicts.filter(v => !v.pass)
    if (verdicts.length && !failing.length) { passed = true; break }
    lastFindings = fmt(failing.flatMap(v => v.findings))
    if (round === MAX_ROUNDS) break
    built = await agent(
      `${impl}\n\n지금 할 일: 검증에서 반려된 항목을 고치세요(테스트 먼저). ${CHECK}를 통과시키고, 커밋은 하지 마세요.\n\n반려 사항:\n${lastFindings}`,
      { label: `implementer:fix:${tag}:r${round}`, phase: 'Build', schema: WORK_RESULT },
    )
  }

  phase('Complete')
  if (passed) {
    const c = await agent(
      `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 조각 ${slice.id} 완료 처리. 체크박스 [x], docs/prd 갱신, history.md, current-state.md, lineage.md 갱신 후 ${CHECK} 통과를 확인하고 커밋하세요(push 금지). 커밋 메시지 끝에 다음 줄을 그대로 붙이세요:\n${ATTR}`,
      { label: `prd-maintainer:complete:${tag}`, phase: 'Complete', schema: COMPLETE },
    )
    entry.status = 'done'
    if (c) { entry.commit = c.commit; entry.summary = c.summary; report.questions.push(...c.questions) }
  } else {
    entry.status = 'blocked'
    entry.reason = built && built.status === 'blocked'
      ? built.blockReason
      : `검증 ${MAX_ROUNDS}회 실패:\n${lastFindings}`
    const c = await agent(
      `${role('prd-maintainer', 'PRD Maintainer')}\n\n지금 할 일: 조각 ${slice.id}를 보류 처리. 작업 트리의 이 조각 변경을 \`git stash push -u -m "blocked ${slice.id}"\`로 보관해 다음 조각이 깨끗한 상태에서 시작하게 하고, 작업 파일에 보류 사유와 stash 이름을, current-state.md "대기 중인 질문"에 사람에게 물을 질문을 적은 뒤 문서만 커밋하세요(push 금지). 커밋 메시지 끝에:\n${ATTR}\n\n보류 사유:\n${entry.reason}`,
      { label: `prd-maintainer:park:${tag}`, phase: 'Complete', schema: COMPLETE },
    )
    if (c) report.questions.push(...c.questions)
  }
}

phase('Garden')
const g = await agent(
  `${role('doc-gardener', 'doc-gardener')}\n\n지금 할 일: 이번 작업 묶음 정리. 끝난 계획이면 done/으로 옮기세요. 커밋 메시지 끝에:\n${ATTR}\n결과로 바꾼 내용을 짧게 적으세요.`,
  { label: 'doc-gardener', phase: 'Garden' },
)
report.garden = g
return report
