# Phase 7 — Workflow 지휘 방식

역할끼리 `SendMessage`로 서로 부르지 않고, **Workflow 스크립트 하나가 정해진 순서대로 역할을 실행**하는 방식이다. `team-orchestration.md` "역할 간 호출 수단 확인"의 폴백(지휘자의 기계적 실행)을 스크립트로 고정한 것이다.

## 이 방식을 쓰는 경우

- 역할 간 자동 호출을 쓰지 않기로 했거나, 쓸 수 없는 환경일 때.
- 진행 순서와 반복 횟수를 모델 판단이 아니라 코드로 보장하고 싶을 때.
- 지휘자가 다음 담당자를 실행하지 않아 생기는 공백을 없애고 싶을 때.

## 구성 요소

| 구성 요소 | 위치 | 내용 |
| --- | --- | --- |
| 역할 정의 | `.claude/agents/{prd-maintainer,<구현자>,qa-reviewer,red-team,doc-gardener}.md` | 목적·트리거·입력·출력·소통 대상(없음)·규칙 |
| 운영 규칙 | `docs/team/README.md` | 지휘 방식, 역할 표, 흐름, 사람에게 멈추는 기준 |
| 작업 파일 | `docs/plans/active/<작업>.md` | 요청(사용자 원문), 조각(체크박스와 조각 정의), 결정 로그(날짜·결정·이유·증거·결과 표, 추가만), 진행 기록 |
| 상시 지시 | `docs/team/standing-orders.md` | 번호 붙인 제약 한 줄씩. 모든 역할이 매번 읽는다. 초기값은 `../templates/standing-orders.md` |
| 지휘 스크립트 | `.claude/workflows/team-run.js` | `../templates/team-run.js`를 복사해서 쓴다. `// team-run template vN` 표시가 버전이다(`meta` 블록 바로 아래. 줄 번호가 아니라 이 문자열로 찾는다) |
| 모델 배정 파일 | `.claude/workflows/team-models.json` | 단계별 모델·하한선·조정 상태. 초기값은 `../templates/team-models.json`. 회고 단계가 갱신한다 |
| 실행 기록 | `docs/team/run-log.md` | 실행마다 지표 한 줄. 초기값은 `../templates/run-log.md` |

**지휘 스크립트는 반드시 프로젝트의 `.claude/workflows/`에 저장한다.** Workflow 도구는 실행한 스크립트를 세션 폴더(`~/.claude/projects/<프로젝트>/<세션>/workflows/scripts/`)에만 남긴다. 저장소에 없으면 다른 세션이 이 스크립트를 찾지 못해 매번 새로 작성하게 된다. 저장해 두면 다른 세션에서 이름(`team-run`)으로 실행할 수 있다.

## 흐름 (스크립트가 강제)

1. **트리아지:** PRD Maintainer가 먼저 작업 트리를 확인한다. 작업 파일 말고 다른 미커밋 변경이 있으면 아무것도 고치지 않고 멈춘다. 깨끗하면 요청을 1~4개 조각으로 나누고 조각마다 조각 정의(목표, 범위, 완료 기준, 검증 방법)와 `needsDesign`, `redTeam`, `blocked`를 반환한다. 정의 칸이 하나라도 비면 스크립트가 그 조각을 시작하지 않고 보류로 기록한다. 트리아지 문서는 경로를 지정해 커밋하고, 작업 트리가 깨끗해졌는지(`treeClean`) 알린다.
2. **조각마다 차례로 진행한다.** 같은 파일을 건드리므로 병렬로 실행하지 않는다.
   1. 설계(`needsDesign`인 조각만): 구현자가 `docs/design/`에 설계를 적고 레드팀이 검토한다. 합의는 최대 3회.
   2. 구현: 구현자가 TDD로 구현하고 검사를 통과시킨다. 커밋은 하지 않는다.
   3. 검증: QA는 항상, 레드팀은 지정된 조각만 병렬로 판정한다. 검토자는 구현자 보고가 아니라 완료 기준을 직접 확인하고, 실제로 확인한 수준을 `level`(run: 실제 앱·명령, test: 테스트만, check: 정적 검사만)로 반환한다. 통과한 조각의 수준은 검토자 중 가장 낮은 값으로 보고에 남는다. 배정된 검토자의 결과가 모두 있고 모두 통과여야 통과다. 결과가 없는 검토자가 있으면 통과로 치지 않고 보류한다. 반려되면 구현자가 고친다. 최대 3회.
   4. 완료: 코드는 고치지 않는다(검증 뒤 코드가 바뀌면 검증이 무효다). PRD Maintainer가 체크박스, PRD, `current-state.md`, `lineage.md`를 갱신하고 커밋한다(push 금지). 커밋까지 성공해야 `done`이다. 검증은 통과했지만 커밋하지 못하면 `verified-uncommitted`로 남긴다.
   5. 보류: 설계·구현·검증 어느 단계에서든 멈추면(3회 안에 합의·통과 실패, 에이전트 실패 포함) PRD Maintainer가 그 조각의 변경을 `git stash push -u -m "blocked <조각>"`으로 보관한다. 질문은 `current-state.md` "대기 중인 질문"에 남기고 다음 조각으로 넘어간다.
   6. 작업 트리 확인: 조각은 깨끗한 작업 트리에서만 시작한다. 그래서 보류 stash에는 그 조각의 변경만 들어간다. 완료나 보류 뒤 작업 트리가 깨끗하지 않으면, 남은 조각은 시작하지 않고 보류로 기록한다.
3. **정리:** doc-gardener가 문서-코드 불일치를 고치고, 끝난 계획을 `docs/plans/done/`으로 옮긴다. 이전 실행의 정리 누락을 발견하면 `previousRunMisses`로 알린다.
4. **회고:** 스크립트가 이번 지표로 모델 배정을 계산하고, 회고 기록자가 `team-models.json`과 `run-log.md`에 그대로 옮겨 커밋한다. 아래 "모델 배정과 자동 조정".

## 설계 원칙

- **스크립트는 판단하지 않는다.** 분기는 역할이 반환한 구조화된 값(`pass`, `status`, `needsDesign`, `redTeam`, `blocked`)으로만 한다.
- **역할끼리 대화하지 않는다.** 한 역할의 결과는 작업 파일과 Workflow 반환값으로만 다음 역할에 넘어간다. 반려 사항은 스크립트가 `[심각도] 위치: 문제 → 고칠 방법` 형식으로 다음 프롬프트에 그대로 넣는다.
- **역할 프롬프트는 짧게 둔다.** 프롬프트에는 "역할 파일과 `docs/team/README.md`를 읽고 따르라", 작업 파일 경로, 지금 할 일만 넣는다. 규칙은 역할 파일에 한 번만 적는다.
- **사람에게 묻지 않는다.** 결정은 추천안으로 하고 작업 파일 "결정 로그"에 이유를 남긴다. 멈춰야 하는 경우만 반환값의 `questions`·`blockReason`에 적는다.
- **조각 정의를 못 채우면 시작하지 않는다.** 목표·범위·완료 기준·검증 방법은 브리프다. 채울 수 없는 칸은 아직 범위가 정해지지 않았다는 뜻이다. 출처: pstack `playbooks/orchestrate.md` "The brief".
- **지시는 파일로 이어진다.** 사람이 반복한 지시는 `docs/team/standing-orders.md`에 쌓이고, 역할 프롬프트가 매번 그 파일을 읽게 한다. 프롬프트에 지시를 늘리지 않는다.
- **커밋은 한 역할만 한다.** 구현자·QA·레드팀은 커밋하지 않고, PRD Maintainer와 doc-gardener만 커밋한다. 커밋 끝 줄(attribution)은 메인 세션이 `args.attribution`으로 넘긴다.

## 사람에게 멈추는 기준 (`docs/team/README.md`에 적는다)

해당 조각만 보류하고 다른 조각은 계속한다.

- 새 외부 의존성(패키지, 바이너리, 시스템 도구)
- 레이어 규칙이나 검사 자체를 바꾸는 변경
- 같은 실패 3회 반복, 또는 레드팀·구현자가 3회 안에 합의 실패
- 서명·배포·push 등 외부로 나가는 작업
- 구현이 PRD(`docs/prd/`)의 의도와 어긋남
- 보안 경계 변경(인증·권한·자격증명·네트워크 노출). 단 작업 파일 "요청"에 사용자 원문으로 승인이 있으면 진행한다. 하네스 웹 앱 기본값(`127.0.0.1` 바인드, 고정 포트, 기본 경로)을 그대로 따르는 변경은 이미 승인된 기본값이라 해당하지 않는다(harness-engineering `references/webapp-remote-access.md` 0-2절)

## 구성 절차

1. Phase 0~3이 갖춰졌는지 확인한다. 최소 조건은 세 가지다: 검사 명령 하나(예: `scripts/check-all.sh`), `docs/plans/current-state.md`, `docs/design/`.
2. 역할 정의 5개를 만든다. 형식은 `team-orchestration.md` "역할 선언"을 따른다. 소통 대상은 모두 "없음(파일과 Workflow 반환값으로만)"으로 둔다. 구현자에게는 프로젝트의 레이어 규칙·생성 코드 금지·환경 제약과 karpathy-guidelines(이 스킬 `SKILL.md` "공통 원칙")를 적는다.
3. `docs/team/README.md`를 위 흐름과 멈추는 기준으로 작성하고 `docs/README.md` 인덱스에 링크한다.
4. `../templates/team-run.js`를 `.claude/workflows/team-run.js`로, `../templates/team-models.json`을 `.claude/workflows/team-models.json`으로, `../templates/run-log.md`를 `docs/team/run-log.md`로 복사한다. 구현자 역할 파일 이름과 검사 명령이 기본값과 다르면 실행 때 `args`로 넘긴다. 스크립트 본문은 프로젝트 사정에 맞을 때만 고친다.
5. `../templates/standing-orders.md`를 `docs/team/standing-orders.md`로 복사한다. `CLAUDE.md` "문서 지도"에 팀 문서 링크를 한 줄 추가한다. 검사 통과 후 커밋한다.
6. 작은 요청 하나로 시험 실행할지 사용자에게 묻는다.

## 실행 방법 (메인 세션)

1. 사용자 요청을 해석 없이 `docs/plans/active/<작업>.md` "요청 (사용자 원문, 날짜)"에 적는다. "조각", "결정 로그", "진행 기록" 절은 비워 둔다. 작업 파일 말고 다른 미커밋 변경이 있으면 트리아지가 멈추므로, 실행 전에 사용자에게 알리고 정리를 부탁한다.
2. Workflow를 실행한다. `name: "team-run"`(또는 `scriptPath`)을 쓰고, `args`는 아래와 같다.

```json
{
  "workFile": "docs/plans/active/<작업>.md",
  "attribution": "<이 세션의 커밋 끝 줄>",
  "implementer": "<구현자 역할 파일 이름, 기본 implementer>",
  "check": "<검사 명령, 기본 scripts/check-all.sh>",
  "date": "<YYYY-MM-DD>",
  "modelState": <.claude/workflows/team-models.json 내용>,
  "userReportedBugs": <지난 실행 뒤 사용자가 버그를 알렸으면 true>
}
```

3. 끝나면 조각별 상태(done / verified-uncommitted(검증은 통과했지만 완료 커밋 실패) / blocked), 검증 수준(`verifyLevel`, run·test·check), 커밋, 질문, 모델 변경(`modelChanges`)을 결론부터 짧게 알린다. 모델을 내렸으면 반드시 알린다. 팀이 남긴 질문은 고쳐 쓰지 않고 그대로 전한다.
4. 완료 알림의 서브에이전트 토큰과 걸린 시간을 `docs/team/run-log.md` 마지막 줄의 "토큰"·"시간" 칸에 채우고 그 파일만 커밋한다(`git commit -- docs/team/run-log.md`).
5. 사용자가 이전에 한 지시를 다시 하면, 따르기 전에 `docs/team/standing-orders.md`에 한 줄 추가하고 그 파일만 커밋한다.
6. 보류된 조각을 사람이 답하면, 그 답을 작업 파일 "결정 로그"에 적고 다시 실행한다. 같은 세션이면 `resumeFromRunId`로 끝난 단계를 재사용한다.

Workflow는 사용자의 명시적 요청이 있어야 실행할 수 있다. 다음 경우는 요청으로 본다.
- 사용자가 "에이전트 팀으로 진행해", "워크플로우로 돌려" 같이 직접 말한 경우
- 사용자가 이 스킬을 부르면서 팀 실행을 요청한 경우

트리아지만 끝났는데 실행 요청이 없으면 실행하지 말고 사용자에게 묻는다.

## 모델 배정과 자동 조정

판단이 어려운 단계만 Opus를 쓰고, 나머지는 비용이 낮은 모델을 쓴다. 배정은 실행 기록을 보고 프로젝트 안에서 스스로 고친다. 계산은 스크립트 코드가 하므로 같은 기록에는 항상 같은 결과가 나온다. 회고 기록자는 계산 결과를 옮겨 적기만 한다.

### 기본 배정

모델 단계는 Haiku < Sonnet < Opus다.

| 단계 | 역할 | 기본 모델 / effort | 조정 | 하한선 |
| --- | --- | --- | --- | --- |
| design | 구현자 | Opus | 고정 | — |
| redTeam | 레드팀 | Opus / high | 고정 | — |
| retro | 회고 기록자 | Sonnet / low | 고정 | — |
| build, fix | 구현자 | Opus | 대상 | Sonnet |
| triage | PRD Maintainer | Sonnet | 대상 | Sonnet |
| qa | QA | Sonnet | 대상 | Sonnet |
| complete, park | PRD Maintainer | Sonnet | 대상 | Sonnet |
| garden | doc-gardener | Sonnet / low | 대상 | Haiku |

레드팀·설계·회고를 고정하는 이유: 품질 기준을 판단하는 역할이 스스로 약해지면 결함을 잡을 수단이 없어진다.

### 실행마다 정하는 결과

조정 대상 단계마다 이번 실행의 결과를 `problem`, `clean`, `skip` 중 하나로 정한다.

| 단계 | problem | clean으로 셀 수 있는 조건 |
| --- | --- | --- |
| qa | 어떤 조각에서 "QA 통과인데 레드팀 반려", 또는 `userReportedBugs` | 레드팀 구현 검증이 함께 있었던 실행 |
| triage | 설계 라운드 2회 이상 또는 보류된 조각 | 항상 |
| build, fix | 검증 라운드 2회 이상인 조각 | 검증이 있었던 실행 |
| complete | 완료 커밋 실패 | 완료된 조각이 있었던 실행 |
| park | 보류 커밋 실패 | 보류 처리를 실제로 실행한 실행 |
| garden | doc-gardener가 이전 실행의 정리 누락을 발견 | 항상 |

**센 실행**은 설계가 있었거나 조각이 2개 이상인 실행이다. `clean`은 센 실행에서만 내리기 횟수에 센다. 작은 작업이 이어져 잘못 내려가는 것을 막기 위해서다.

### 규칙

- **올리기(자동, 한 단계):** 이번 실행이 `problem`이고, 최근 2회 실행 중 `problem`이 기준 이상일 때. 기준은 qa·triage·garden 2회, build·fix·complete·park 1회다. `userReportedBugs`는 QA를 바로 올린다.
- **내리기(자동, 한 단계):** 센 실행에서 `clean`이 연속 3회일 때. 한 번이라도 올라간 적이 있으면 5회가 필요하다. 하한선 아래로는 내리지 않는다.
- **멈춤:** 같은 단계가 두 번 올라가면 `autoLowerStopped`가 켜지고, 그 단계는 다시 자동으로 내리지 않는다. 사람이 판단한다.
- **잠금:** `locked: true`인 단계는 건드리지 않는다. 사람이 배정 파일을 직접 고친 값이 그대로 다음 실행에 쓰인다.
- **변경 폭:** 한 실행에서 단계당 한 단계(tier)까지만 바꾼다.
- **기록과 보고:** 모든 변경은 `run-log.md`와 커밋에 남는다. 메인 세션은 결과 보고에서 모델 변경을 알리고, 내린 경우는 눈에 띄게 알린다.

### 늦게 드러나는 신호

사용자가 화면 확인에서 버그를 찾으면, 메인 세션은 다음 실행에 `userReportedBugs: true`를 넘긴다. 실행 사이에 이미 모델이 내려갔더라도 이 신호로 다시 올라간다.

## 템플릿 업데이트

템플릿이 바뀌면 이미 팀을 구성한 프로젝트도 따라와야 한다. 프로젝트 스크립트에서 `// team-run template vN` 문자열을 찾아(줄 번호에 기대지 않는다) `../templates/team-run.js`와 비교한다.

1. 버전 표시가 없거나 템플릿보다 낮으면, 또는 `team-models.json`, `docs/team/run-log.md`, `docs/team/standing-orders.md` 중 하나라도 없으면 업데이트 대상이다.
2. 프로젝트 스크립트를 그 버전의 템플릿과 비교해 프로젝트만의 수정이 있는지 확인한다. 버전 표시가 없으면 이전 버전과 비교한다. 수정이 있으면 덮어쓰기 전에 사용자에게 보여 주고 묻는다.
3. 스크립트를 새 템플릿으로 바꾸고, 없는 파일(`team-models.json`, `run-log.md`, `standing-orders.md`)을 만든다. v4로 올릴 때는 `docs/team/README.md`의 흐름 설명에 조각 정의와 검증 수준을 반영하고, QA 역할 파일에 "완료 기준을 직접 확인하고 level을 적는다"를, 진행 중 작업 파일의 결정 로그에 표 머리를 추가한다(기존 줄은 그대로). 이미 있는 `team-models.json`은 덮어쓰지 않는다(쌓인 조정 상태를 지킨다).
4. 검사를 통과시키고 이 파일들만 커밋한다(push 금지).

## 운영에서 배운 점

- **작업 트리를 공유한다.** 팀이 도는 동안 메인 세션이 같은 저장소에 커밋하면, 팀의 미커밋 변경과 섞일 수 있다. 메인 세션이 꼭 커밋해야 하면 경로를 지정해서(`git commit -- <경로>`) 자기 파일만 커밋한다.
- **사용량 한도는 선택 사항이다.** 장시간 실행이 걱정되면 사용량 감시 스크립트를 백그라운드로 함께 실행하고, 한도에 닿으면 Workflow를 중지할 수 있다. 규칙으로 둘지는 사용자가 정한다.
- **실기기·화면 확인은 사람 몫으로 남긴다.** 팀이 확인할 수 없는 항목은 QA가 "사용자 확인" 항목으로 `current-state.md`에 남기게 한다. 이것만으로는 조각을 반려하지 않는다.
