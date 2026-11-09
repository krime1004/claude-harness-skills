---
name: harness-agent-team
description: 하네스(harness-engineering)가 적용된 저장소에 전문 에이전트 팀(PRD Maintainer, 구현자, QA/리뷰어, 레드팀, doc-gardener)을 구성하거나, 구성된 팀으로 작업을 실행·재개한다. 기본 지휘 방식은 Workflow 스크립트다. harness-engineering의 Phase 7은 이 스킬로 진행한다. "에이전트 팀 만들어줘", "에이전트 팀 구성해줘", "에이전트 팀으로 진행해", "팀으로 돌려줘", "워크플로우로 팀 실행해", "보류된 조각 이어서 해줘" 같은 요청에 사용한다. 하네스 자체가 없으면 harness-engineering 스킬을 먼저 쓴다.
---

# 하네스 위의 전문 에이전트 팀

harness-engineering 스킬의 Phase 7(전문 에이전트 팀 구성과 자율 운영)을 맡는다. 팀 관련 규칙·템플릿의 원본은 이 스킬에만 있다.

| 파일 | 내용 |
| --- | --- |
| `references/workflow-orchestration.md` | Workflow 지휘 방식(기본): 구성 요소, 흐름, 멈추는 기준, 구성·실행 절차, 운영에서 배운 점 |
| `templates/team-run.js` | Workflow 지휘 스크립트 원본(현재 v4). 프로젝트 `.claude/workflows/team-run.js`로 복사한다 |
| `templates/team-models.json` | 모델 배정 파일 초기값. 프로젝트 `.claude/workflows/team-models.json`으로 복사한다 |
| `templates/run-log.md` | 실행 기록 초기값. 프로젝트 `docs/team/run-log.md`로 복사한다 |
| `templates/standing-orders.md` | 상시 지시 초기값. 프로젝트 `docs/team/standing-orders.md`로 복사한다 |
| `templates/archive/` | 이전 버전 템플릿. 업데이트할 때 프로젝트만의 수정을 찾는 비교 기준 |
| `references/team-orchestration.md` | 역할 선언 형식, 단계별 소통 매트릭스, 상태 영속화, 에스컬레이션 기준 전문. `SendMessage` 방식도 담는다 |

경로는 모두 이 스킬 폴더(`~/.claude/skills/harness-agent-team/`) 기준이다. 시작할 때 `references/workflow-orchestration.md`를 반드시 읽는다.

## 공통 원칙

- **지휘 방식:** 기본은 Workflow 스크립트 하나가 정해진 순서대로 역할을 실행하는 방식이다. 순서와 반복 횟수가 코드로 보장되고, 다음 담당자를 아무도 실행하지 않는 공백이 생기지 않는다. 역할끼리 `SendMessage`로 부르는 방식은 사용자가 원할 때만 쓴다. 그때는 `references/team-orchestration.md` "역할 간 호출 수단 확인"을 먼저 따른다.
- **스크립트 저장 위치:** 반드시 프로젝트의 `.claude/workflows/`에 둔다. 세션 폴더에만 남으면 다른 세션이 쓰지 못한다.
- **모델 배정:** 판단 단계(설계, 레드팀, 회고)는 고정하고, 나머지는 실행 기록으로 스스로 조정한다. 문제가 생기면 바로 올리고, 센 실행에서 연속으로 깨끗할 때만 한 단계씩 내린다. 규칙은 `references/workflow-orchestration.md` "모델 배정과 자동 조정".
- **지휘자(메인 세션)는 판단하지 않는다.** 팀 구성과 사람 요청 중계(해석 없이 그대로 전달)만 한다. 진행 추적, 에스컬레이션 판단, 병합 승인은 모두 팀원 몫이다.
- **역할 구성:**
  - 고정 코어: QA/리뷰어, doc-gardener/archivist, PRD Maintainer(신규 요청 트리아지 담당 겸임)
  - 동적: 구현자(블루팀, 도메인별), 레드팀(품질 전반의 흠을 찾음, 위험도·작업 규모에 따라 소집)
- **역할 선언:** 모든 역할은 생성 시 목적·트리거·입출력·소통 대상을 선언한다. Workflow 방식에서는 소통 대상을 "없음(파일과 Workflow 반환값으로만)"으로 둔다.
- **코드 변경 담당자:**
  - 코드를 구현·수정·리팩터링하는 역할의 정의 본문과 최초 호출 지시에 `~/.claude/skills/karpathy-guidelines/SKILL.md`를 읽고 적용하라고 적는다. 가정 확인, 최소 구현, 필요한 부분만 변경, 검증 가능한 완료 기준을 도메인 스킬과 함께 쓴다.
  - 기존 스타일과 기존 미사용 코드는 그대로 둔다. 자기 변경으로 새로 미사용이 된 코드만 정리한다.
  - 스킬에 접근할 수 없는 담당자에게는 호출 지시에 위 네 원칙을 직접 넣는다.
  - 코드 리뷰 담당자도 같은 기준으로 diff를 본다. 비코딩 역할에는 강제하지 않는다.
- **진행 상태는 파일로만 존재한다.** 위치는 `docs/plans/active/`, `docs/plans/lineage.md`, `docs/prd/`다. 세션을 다시 시작할 때의 진입점은 `docs/plans/current-state.md`다.
- **사람에게 멈추는 기준:** `references/workflow-orchestration.md` "사람에게 멈추는 기준"을 따른다. 해당 조각만 보류하고 나머지는 계속한다.
- **역할 정의 형식:** `references/team-orchestration.md` "역할 선언"의 네 항목(목적·트리거·입출력·소통 대상)을 `## 선언` 절로 두고, 그 아래에 역할 규칙을 번호로 적는다.

## 1. 상태 판별

아래를 확인해 어느 모드로 갈지 정한다.

| 확인 | 없으면 |
| --- | --- |
| `CLAUDE.md`, `docs/plans/current-state.md`, 검사 명령(예: `scripts/check-all.sh`) | 하네스 미적용 → harness-engineering 스킬로 Phase 0~3부터 진행하자고 제안하고 멈춘다 |
| `.claude/agents/`의 역할 5개, `docs/team/README.md` | 팀 미구성 → "2. 구성 모드" |
| `.claude/workflows/team-run.js`(또는 같은 역할의 스크립트) | 스크립트만 없음 → "2. 구성 모드"의 4단계만 한다 |
| 스크립트의 `// team-run template vN` 표시(줄 번호가 아니라 이 문자열로 찾는다)가 `templates/team-run.js`와 같은 버전, `team-models.json`, `docs/team/run-log.md`, `docs/team/standing-orders.md` | 하나라도 아니면 → "4. 업데이트 모드" |

모두 있으면 "3. 실행 모드"로 간다. 기존 팀이 `SendMessage` 방식이면 그대로 두고, Workflow 방식으로 바꿀지 사용자에게 묻는다.

## 2. 구성 모드

`references/workflow-orchestration.md` "구성 절차"를 따른다. 요약하면 다음과 같다.

1. 기존 하네스 문서를 읽고 프로젝트의 레이어 규칙, 생성 코드 금지, 환경 제약, 검사 명령을 파악한다. 근거는 `CLAUDE.md`와 `docs/architecture/`다.
2. `.claude/agents/`에 역할 5개를 만든다: `prd-maintainer`, 구현자(도메인 이름 가능, 예: `mac-implementer`), `qa-reviewer`, `red-team`, `doc-gardener`.
3. `docs/team/README.md`를 쓰고 `docs/README.md` 인덱스와 `CLAUDE.md` "문서 지도"에 링크한다.
4. `templates/team-run.js`를 `.claude/workflows/team-run.js`로, `templates/team-models.json`을 `.claude/workflows/team-models.json`으로, `templates/run-log.md`를 `docs/team/run-log.md`로, `templates/standing-orders.md`를 `docs/team/standing-orders.md`로 복사한다. 스크립트 내용은 고치지 않는다. 구현자 이름과 검사 명령은 실행 때 `args`로 넘긴다.
5. 검사를 통과시키고 커밋한다(push 금지). 새 외부 의존성이 필요하거나 검사 자체를 바꿔야 하면 먼저 사용자에게 묻는다.
6. 작은 요청 하나로 시험 실행할지 사용자에게 묻는다.

## 3. 실행 모드

`references/workflow-orchestration.md` "실행 방법"을 따른다.

1. 사용자 요청을 해석하지 않고 `docs/plans/active/<작업>.md`에 적는다. 작업 파일 말고 다른 미커밋 변경이 있으면 트리아지가 아무것도 하지 않고 멈춘다. 먼저 사용자에게 알리고 정리를 부탁한다. "요청 (사용자 원문, 날짜)"를 채우고, "조각", "결정 로그", "진행 기록" 절은 비워 둔다. 이미 있는 작업 파일을 이어서 하는 경우라면, 사람의 답을 "결정 로그"에 적는다.
2. Workflow를 실행한다. 이 스킬을 부른 것 자체가 Workflow 실행 요청이다. 단, 구성 모드에서 시험 실행은 사용자가 승낙할 때만 한다.
   - 스크립트: `name: "team-run"`. 이름으로 찾지 못하면 `scriptPath: ".claude/workflows/team-run.js"`를 쓴다.
   - `args`: `workFile`, `attribution`(이 세션의 커밋 끝 줄), `implementer`(구현자 역할 파일 이름), `check`(검사 명령), `date`(오늘 날짜), `modelState`(`.claude/workflows/team-models.json` 내용), `userReportedBugs`(지난 실행 뒤 사용자가 버그를 알렸으면 true).
3. 실행 중에는 팀의 미커밋 변경을 건드리지 않는다. 메인 세션이 꼭 커밋해야 하면 `git commit -- <경로>`로 자기 파일만 커밋한다.
4. 끝나면 조각별 상태(done / verified-uncommitted(검증은 통과했지만 완료 커밋 실패) / blocked), 검증 수준(run·test·check), 커밋, 질문, 모델 변경(`modelChanges`)을 결론부터 짧게 알린다. 모델을 내렸으면 반드시 알린다. 팀이 남긴 질문은 고쳐 쓰지 않고 그대로 전한다.
5. 완료 알림의 서브에이전트 토큰과 걸린 시간을 `docs/team/run-log.md` 마지막 줄 "토큰"·"시간" 칸에 채우고 그 파일만 커밋한다.

## 4. 업데이트 모드

`references/workflow-orchestration.md` "템플릿 업데이트"를 따른다. 사용자가 "에이전트 팀 최신 방식으로 업데이트해줘"라고 하거나, 실행 모드에 들어가기 전 상태 판별에서 버전이 낮으면 이 모드로 간다. 실행 요청 중에 발견했다면 업데이트부터 하겠다고 알리고 진행한다. 프로젝트만의 수정이 있으면 덮어쓰기 전에 묻는다.

## 하지 않는 것

- 지휘자는 조각을 나누거나 판정을 바꾸지 않는다. 판단은 역할이 하고, 순서는 스크립트가 정한다.
- 조각을 병렬로 돌리지 않는다. 같은 작업 트리를 공유한다.
- push, 배포, 서명은 하지 않는다. 사용자가 따로 요청할 때만 한다.

## 변경 이력

| 날짜 | 변경 내용 | 사유 |
| --- | --- | --- |
| 2026-11-09 | `harness:harness` 플러그인 참조 삭제. 역할 정의 형식은 `team-orchestration.md` "역할 선언"(`## 선언` 절)으로 자체 완결, 도구 목록 첫 보고 조언은 본문에 흡수 | 그 플러그인을 쓰지 않기로 함 |
| 2026-11-09 | Workflow 방식 "사람에게 멈추는 기준"에 보안 경계 변경 추가(작업 파일 요청에 사용자 승인 원문이 있으면 진행). 기준 A에 하네스 웹 앱 기본값 예외 추가. 템플릿 버전은 그대로 v4. 기존 팀은 harness-engineering 업그레이드 v3의 3-13 항목으로 `docs/team/README.md`에 반영 | SendMessage 방식 기준 A에는 있고 Workflow 방식에는 없던 불일치. 웹 앱 기본 규칙에서 인증·외부 공개가 팀 조각이 될 수 있어서 |
| 2026-10-26 | 템플릿 v4: 트리아지가 조각마다 목표·범위·완료 기준·검증 방법을 채우고 빈 칸이 있으면 스크립트가 시작하지 않음, 검토자가 확인 수준(`level`: run·test·check)을 반환하고 보고에 남음, 상시 지시 파일(`standing-orders.md`)을 모든 역할이 읽음, 결정 로그에 증거 칸, 완료 단계는 코드 수정 금지 | cursor/plugins pstack `orchestrate.md`의 브리프 필드·검증 장부·상시 지시 방식을 가져옴 |
| 2026-10-23 | 템플릿 v3: 배정된 검토자 결과가 모두 있어야 통과, 완료 커밋 실패는 `verified-uncommitted`, 트리아지 커밋과 깨끗한 작업 트리 확인 뒤에만 조각 시작(보류 stash가 다른 변경을 쓸어 가지 않게), 설계 단계 보류도 공통 보류 처리를 거침, 버전은 표시 문자열로 찾음 | 리뷰에서 검토 누락 통과, 완료 오보고, stash 범위, 설계 보류 누락, 버전 위치 불일치가 지적됨 |
| 2026-10-23 | 템플릿 v2: 역할별 모델 배정, 지표(`metrics`), 회고 단계, 모델 자동 조정(`team-models.json`, `run-log.md`), 업데이트 모드 | 토큰을 효율적으로 쓰고, 이미 팀을 구성한 프로젝트도 따라오게 하기 위해 |
| 2026-10-23 | 스킬 생성. harness-engineering Phase 7의 원칙과 `team-orchestration.md`를 옮기고 Workflow 지휘 방식과 `team-run.js` 템플릿을 추가 | Workflow 팀을 다른 프로젝트에서도 쓰고, 팀 내용을 한 곳에서 관리하기 위해 |
