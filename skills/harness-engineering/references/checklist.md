# Harness Engineering 체크리스트 & 템플릿

목차
- Phase 0 진단 체크리스트
- Phase 1 CLAUDE.md 템플릿
- Phase 2 docs/ 구조 템플릿
- Phase 3 약한 규칙 → 강한 규칙 변환 예시
- Phase 5 golden-principles.md 템플릿
- Phase 6 doc-gardening: 문서-코드/문서 드리프트 추적

---

## Phase 0 진단 체크리스트

- [ ] `CLAUDE.md` 존재 여부, 줄 수, 인덱스 역할 여부
- [ ] `docs/` 디렉토리 존재 여부와 구조 일관성
- [ ] 린터/타입체커/포매터 존재 여부, CI에서 강제되는지
- [ ] 구조 테스트(의존성 방향, 레이어 경계) 존재 여부
- [ ] pre-commit/PreToolUse/PostToolUse 훅 존재 여부
- [ ] 구조화 로깅 여부 (JSON 로그 등), 로그를 쿼리할 수단 여부
- [ ] 최근 PR/리뷰에서 반복된 지적 사항 수집 (3~5개 샘플로 충분)
- [ ] 테스트/빌드 실패 메시지가 원인을 명확히 알려주는지 샘플 확인
- [ ] 규칙·강제수단 대응표가 있는지, 강제수단 없는 규칙이 몇 개인지 (`rule-enforcement.md`)
- [ ] 앱을 실행하고 조작해 증거를 남기는 검증 스킬(`.claude/skills/verify-<app>/`)이 있는지 (`verification-skill.md`)
- [ ] 웹 앱이거나 웹 앱 예정인지. 그렇다면 고정 포트·`127.0.0.1` 바인드·기본 경로·인증·외부 접속 규칙과 골격 검사가 있는지 (`webapp-remote-access.md`)

진단 결과는 표로 정리해 사용자에게 보고한다. 각 항목을 "없음 / 부분적 / 충분함"으로 평가하고, "없음"이 많은 영역부터 우선순위를 제안한다.

---

## Phase 1 — CLAUDE.md 템플릿 (100~150줄 목표)

```markdown
<!-- harness-engineering v3 -->
# 프로젝트명

새 세션은 [docs/plans/current-state.md](docs/plans/current-state.md)부터 읽는다.

## 빌드 / 테스트 / 실행
- 빌드: `...`
- 테스트: `...`
- 로컬 실행: `...`

## 핵심 불변식 (3~7개만)
- 예: 모든 외부 입력은 경계에서 스키마 검증을 거친다.
- 예: `service/` 레이어는 `ui/`를 import할 수 없다.

## 규칙과 강제수단
| 규칙 | 강제수단 | 실패를 증명한 사례 |
| --- | --- | --- |
| `service/`는 `ui/`를 import하지 않는다 | `tests/architecture/test_layer_boundaries.py` | <커밋 SHA 또는 PR> |

강제수단이 "없음"인 규칙이 다시 지적되면 한 수준 올려 고친다(`rule-enforcement.md`). 길어지면 `docs/`로 옮기고 링크만 둔다.

## 문서 지도
- 앱 검증 방법: `.claude/skills/verify-<app>/SKILL.md`
- 아키텍처 전체 지도: `docs/architecture/README.md`
- 설계 문서 인덱스: `docs/design/README.md`
- 진행 중 계획: `docs/plans/README.md`
- 알려진 기술 부채: `docs/tech-debt/README.md`
- 코드베이스 전체 규칙: `docs/golden-principles.md`

## 작업 방식
- 세션을 끝내기 전 `docs/plans/current-state.md`를 덮어써서 갱신한다. 날짜별 인수인계 파일은 만들지 않는다.
- 멈출 때 미커밋 변경은 `wip:` 커밋으로 남긴다. 이어받을 때 끝난 일은 다시 하지 않고, "완료" 주장만 실제 결과물로 확인한다.

## 에스컬레이션 규칙
- 공개 API를 변경해야 하는 작업이면 먼저 사용자에게 확인한다.
- 보안 경계(인증/권한/자격증명)를 건드리는 변경은 반드시 승인받는다.
```

**넣지 않을 것**: 전체 코딩 컨벤션 나열, 각 모듈 상세 설명, 긴 예시 코드 블록. 모두 `docs/`로 옮긴다.

---

## Phase 2 — docs/ 구조 템플릿

```
docs/
├── README.md
├── architecture/
│   ├── README.md          # 도메인/레이어 지도, 의존성 방향 다이어그램
│   └── <domain>.md
├── design/
│   ├── README.md          # 각 설계 문서 + 상태(초안/수락/폐기) + 한 줄 요약
│   └── <feature>.md
├── plans/
│   ├── README.md
│   ├── current-state.md    # 현재 상태 한 장 — 새 세션의 시작점, 매번 덮어쓴다 (60줄 이하)
│   ├── active/             # 진행 중 실행 계획 (진행 상황, 의사결정 로그 포함)
│   ├── done/               # 완료된 계획 원본 보관
│   └── lineage.md          # 완료 작업의 압축 이력, 한 작업당 한두 줄 (append-only)
├── prd/                    # 제품 현재 상태 (구조·갱신 주체: harness-agent-team 스킬의 team-orchestration.md, 최초 생성: PRD 없는 기존 프로젝트는 existing-project-onboarding.md)
│   ├── README.md
│   ├── <섹션>.md
│   └── history.md          # 결정/갱신 이력 (append-only)
├── tech-debt/
│   ├── README.md          # 부채 목록 + 영향도 + 상태
│   └── <item>.md
└── golden-principles.md
```

각 `README.md`는 `~/.claude/CLAUDE.md`의 문서 작성 규칙을 그대로 따른다: `[제목](파일.md) — 한 줄 요약` 형태로 링크한다.

**design/<feature>.md 템플릿:**

```markdown
# <기능명>

상태: 초안 | 수락 | 폐기 (날짜)

## 목표
## 결정 사항과 이유
## 트레이드오프
## 관련 코드 위치
```

**plans/active/<task>.md 템플릿 (실행 계획, 복잡한 작업용):**

```markdown
# <작업명>

## 목표
## 진행 상황
- [ ] 단계 1
- [ ] 단계 2

## 의사결정 로그
| 날짜 | 결정 | 이유 | 증거 | 결과 |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | <고른 것, 한 줄> | <쉬운 말로. 설계 문서에 이미 적었다면 링크만> | <커밋 SHA, `파일:줄`, 산출물 경로. 문단 금지> | <테스트 통과, 되돌림, 미결 등> |
```

의사결정 로그는 추가만 한다. 틀린 결정은 고치거나 지우지 않고, 바로잡는 새 줄을 추가한다.

간단한 변경은 이런 문서 없이 바로 작업해도 된다. 계획 문서는 복잡하거나 여러 세션에 걸치는 작업에만 만든다. 작업이 끝나면 파일을 `plans/done/`으로 옮기고 `plans/lineage.md`에 한두 줄로 요약한다.

**plans/current-state.md 템플릿 (세션 인수인계, 60줄 이하):**

```markdown
# 현재 상태

갱신: YYYY-MM-DD

이 파일은 하나만 두고 매번 덮어쓴다. 결정 내용은 여기에 다시 적지 않고 기록된 문서를 링크한다.
완료 이력은 [lineage.md](lineage.md)에 남긴다.

## 지금 단계
<한두 문장. 진행 중 작업은 [active/<작업>.md](active/<작업>.md)로 링크>

## 다음 할 일
1. <새 세션이 바로 실행할 수 있는 행동. 근거가 되는 결정은 링크로만 가리킨다>

## 대기 중인 질문
- <사람의 답을 기다리는 질문. 없으면 "없음">
```

- 갱신 시점: 컨텍스트 사용량이 높아져 세션을 나누기로 할 때, 그리고 세션을 끝내기 전.
- 세 항목 밖의 내용(결정의 이유, 작업 경과, 지난 세션 요약)은 적지 않는다. 각각 `design/`, `plans/active/<작업>.md`, `plans/lineage.md`가 맡는다.
- 대기 중인 질문에 답을 받으면, 답은 결정을 기록하는 문서에 적고 이 파일에서는 질문을 지운다.
- 날짜별 인수인계 파일(`handoff-<날짜>.md` 등)은 만들지 않는다. 이미 있다면 아직 유효한 내용만 `current-state.md`에 옮기고 지운다.

---

## Phase 3 — 약한 규칙 → 강한 규칙 변환 예시

**약함 (산문, 지켜지지 않음):**
> API 응답 타입은 가능하면 명시적으로 선언하는 것을 선호합니다.

**강함 (TypeScript, ESLint 커스텀 규칙 또는 타입 체크 강제):**
```jsonc
// .eslintrc 일부
{
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error"
  }
}
```
에러 메시지에 왜/어떻게가 없다면 커스텀 규칙으로 감싸 메시지를 보강한다.

**약함:**
> 서비스 레이어에서 UI 레이어를 참조하지 않도록 주의해주세요.

**강함 (구조 테스트 예시, 언어 무관하게 응용 가능한 패턴):**
```python
# tests/architecture/test_layer_boundaries.py
def test_service_does_not_import_ui():
    violations = find_imports(source_dir="service/", forbidden_prefix="ui.")
    assert not violations, (
        f"service/ 레이어가 ui/를 import함: {violations}\n"
        f"수정: service/ 코드는 순수 로직만 담고, UI 연동은 ui/ 레이어에서 service를 호출하는 방향으로 바꾸세요."
    )
```

**약함:**
> 새 파일에는 400줄 넘게 쓰지 말아주세요.

**강함 (Claude Code 훅, 이미 이 프로젝트의 글로벌 설정에 적용된 실제 사례):**
`~/.claude/hooks/check-markdown-line-limit.py` + `settings.json`의 `PreToolUse` 훅. Write/Edit 결과가 제한을 넘으면 도구 실행 자체를 차단한다. 같은 패턴을 소스 코드 파일 크기 제한, 금지된 import 패턴 차단 등에도 적용할 수 있다. 훅 작성 절차는 `update-config` 스킬을 사용한다(파이프테스트 → 실제 트리거 확인 포함).

**약함:**
> 세션을 끝낼 때는 인수인계 내용을 잘 정리해 주세요.

**강함 (`plans-state` 검사 — 셸 스크립트라 프로젝트 언어와 무관, pre-commit 훅과 CI에서 실행):**
```bash
#!/usr/bin/env bash
# scripts/check-plans-state.sh — 저장소 루트에서 실행
set -euo pipefail
state=docs/plans/current-state.md
limit=60
errors=""

# 1) 날짜별 인수인계 파일 금지
stray=$(find docs/plans -type f 2>/dev/null | grep -iE 'handoff|인수인계' || true)
if [ -n "$stray" ]; then
  errors="${errors}  - 인수인계 파일이 따로 있음: $(echo "$stray" | tr '\n' ' ')\n"
fi

# 2) current-state.md 는 반드시 있고, 한 장(60줄 이하)이어야 한다
if [ ! -f "$state" ]; then
  errors="${errors}  - ${state} 없음\n"
else
  lines=$(wc -l < "$state" | tr -d ' ')
  if [ "$lines" -gt "$limit" ]; then
    errors="${errors}  - ${state} 가 ${lines}줄 (상한 ${limit}줄)\n"
  fi
fi

# 3) CLAUDE.md 에 새 세션 진입점 링크가 있어야 한다
if ! grep -q "$state" CLAUDE.md 2>/dev/null; then
  errors="${errors}  - CLAUDE.md 에 ${state} 링크 없음\n"
fi

# 4) 끝난 계획(체크박스가 모두 체크됨)은 active/ 에 남기지 않는다
for plan in docs/plans/active/*.md; do
  [ -f "$plan" ] || continue
  if grep -qE '^[[:space:]]*- \[[xX]\]' "$plan" && ! grep -qE '^[[:space:]]*- \[ \]' "$plan"; then
    errors="${errors}  - 끝난 계획이 active/ 에 있음: ${plan}\n"
  fi
done

if [ -n "$errors" ]; then
  printf '[FAIL] plans-state\n%b' "$errors"
  echo "  원인: 인수인계 문서가 여러 개이거나 길면 새 세션이 최신 상태를 찾지 못한다."
  echo "  해결: ${state} 하나를 덮어써서 갱신한다(지금 단계·다음 할 일·대기 중인 질문만)."
  echo "        인수인계 파일은 지우고, 결정은 결정 기록에, 완료 이력은 docs/plans/lineage.md 에 남긴다."
  echo "        CLAUDE.md 첫머리에 ${state} 링크를 둔다."
  echo "        끝난 계획은 docs/plans/done/ 으로 옮기고 docs/plans/lineage.md 에 한두 줄 남긴다."
  exit 1
fi
echo "[PASS] plans-state"
```

**핵심 패턴 정리:**
1. 규칙을 발견한다 (리뷰 코멘트, CLAUDE.md의 산문 문장 등)
2. 기계적으로 검사 가능한지 판단한다
3. 검사 스크립트/린터 규칙/훅 중 적합한 형태로 만든다
4. 에러 메시지에 원인 + 수정 방법을 반드시 포함한다
5. CI 또는 훅으로 강제해 우회할 수 없게 한다
6. 새 검사가 과거의 실제 실수에서 실패하는지 확인하고, CLAUDE.md 규칙·강제수단 대응표에 올린다

수정 수준 순서, 점진 강제, 예외 표기, 대응표 형식은 `references/rule-enforcement.md`.

---

## Phase 5 — golden-principles.md 템플릿

```markdown
# Golden Principles

이 문서의 각 항목은 코드베이스 전체에 적용되는 의견 기반 규칙이다.
가능한 항목은 [기계적 검사]로 강제된다.

1. 중복 헬퍼 대신 `shared/` 유틸리티를 사용한다. [린터 규칙: no-duplicate-helper]
2. 외부 입력은 경계에서 스키마 검증을 거친다. [구조 테스트: boundary-validation]
3. 새 의존성 추가는 PR 설명에 이유를 명시한다. [수동 리뷰]
4. 프로세스/워커를 새로 만들 때는 소유권과 실패 시 동작을 문서화한다. [체크리스트 훅]
5. 측정한 수치(속도 향상, 회귀, 지연)는 무엇이 그 수치를 제한하는지 밝히고, 의도한 작업을 측정했는지 확인한 뒤에만 보고한다. [수동 리뷰]
6. 같은 사실은 한 곳에만 적고, 나머지는 링크한다. 현재 상태는 `docs/plans/current-state.md` 한 장에만 둔다. [검사: plans-state]
```

각 항목은 5~10개를 넘지 않게 유지한다. 늘어나면 오래된/덜 중요한 항목을 제거하거나 통합한다.

---

## Phase 6 — doc-gardening: 문서-코드/문서 드리프트 추적

### `covers` frontmatter 규약
대상 문서(`architecture/`, `design/`, `prd/`, `golden-principles.md`, `tech-debt/`, 검증 스킬 기능 지도 `.claude/skills/verify-*/features/`) 상단에 자신이 설명하는 소스/문서 경로를 선언한다. `PreToolUse` 훅으로 빈 선언을 차단한다(구현 예시: `~/.claude/hooks/check-covers-frontmatter.py`).

```yaml
---
covers:
  - src/payments/retry.ts
  - docs/design/payment-retry.md
---
```
경로만 적는다. 심볼 단위 추적은 하지 않는다(오탐은 허용, 누락 방지를 우선한다).

### 신선도 비교 스크립트
git 커밋 시각만 비교한다. 별도 인덱스 파일을 두지 않는다.

```bash
#!/usr/bin/env bash
# scripts/check-doc-drift.sh — 대상 프로젝트의 git 루트에서 실행
set -euo pipefail
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0  # fail-open: git 저장소가 아니면 조용히 통과
fi

broken=$(mktemp)
stale=$(mktemp)
trap 'rm -f "$broken" "$stale"' EXIT

for doc in $(grep -rl '^covers:' docs/architecture docs/design docs/prd \
             docs/tech-debt docs/golden-principles.md \
             .claude/skills/verify-*/features 2>/dev/null || true); do
  doc_time=$(git log -1 --format=%ct -- "$doc" 2>/dev/null); doc_time=${doc_time:-0}
  awk '/^covers:/{f=1;next} f&&/^[ \t]*- /{print $2} f&&!/^[ \t]*- /{exit}' "$doc" \
    | while read -r src; do
    if [ ! -e "$src" ]; then
      echo "⛔ 참조 끊김: $doc → $src" >> "$broken"
      continue
    fi
    src_time=$(git log -1 --format=%ct -- "$src" 2>/dev/null); src_time=${src_time:-0}
    if [ "$src_time" -gt "$doc_time" ]; then
      echo "⚠ 확인 필요: $doc → $src" >> "$stale"
    fi
  done || true
done

cat "$broken" "$stale"
```

### 트리거
1. **정기 스윕** — `loop`/`schedule` 스킬로 예약해 위 스크립트를 실행하고 리포트 출력. 정확한 주기·담당은 대상 프로젝트 규모에 맞춰 정한다.
2. **온디맨드** — 문서를 신뢰하기 전 사람/에이전트가 직접 실행

즉시(실시간) 알림은 두지 않는다. 판정 기준이 git 커밋 시각이라, 커밋 전에 실행되는 훅은 방금 일어난 변경을 볼 수 없어 항상 무의미한 결과만 내기 때문이다.

### 결과 처리
"참조 끊김"을 리포트 최상단에, "확인 필요"를 그 아래에 표시한다. 둘 다 문서 상단에 경고 배너를 남기고 `docs/tech-debt/doc-drift.md`(append-only)에 기록한다. 문서를 고쳐 커밋하면 다음 스윕에서 자동으로 정상 판정된다. 별도의 "해결 처리" 절차는 없다.

### 인정하는 한계
`covers` 자체가 누락되거나 잘못 적히면 이 메커니즘으로 잡지 못한다. `PreToolUse` 훅은 "완전히 비어있음"만 막는다. 대상 문서 수가 적고 리뷰를 거치는 프로젝트에서는 감수 가능한 잔여 리스크다.

이 루프는 대규모 일괄 정리를 대체한다. 기술 부채는 방치할수록 비용이 커지므로 매일 조금씩 줄이는 편이 낫다.
