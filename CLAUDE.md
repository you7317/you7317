# 튼튼설비 운영 앱

배관·설비 소상공인을 위한 문의접수 → 현장확인 → 견적 → 고객승인 → 작업배정 → 자재사용 → 완료정산 통합 관리 웹앱.

## 스택 및 구조

빌드 도구 없는 순수 HTML/CSS/JS (프레임워크, npm 의존성 없음). 파일 5개가 전부다.

- `index.html` — 페이지 골격, 사이드바/탭바 마크업, 스크립트 로드 순서
- `styles.css` — 디자인 토큰(`:root` 커스텀 프로퍼티), 라이트/다크 테마, 반응형(≤780px 모바일)
- `detectors.js` — 4대 리스크 탐지 순수 함수 (DOM·저장소에 의존하지 않음, 입출력은 배열/객체만)
- `store.js` — 데이터 저장 계층. `window.claude.use("db")`(Claude Artifact db capability)가 있으면 그걸 쓰고, 없으면 `localStorage` 폴백으로 동일 인터페이스 제공
- `tests.js` — `detectors.js`에 대한 자체 실행 단위 테스트 스위트 (외부 테스트 러너 없음)
- `app.js` — 해시 라우팅, 렌더링, 이벤트 위임(전부 `data-action`/`data-form` 속성 기반)

## 데이터 모델 (컬렉션)

`customers`, `inquiries`, `siteVisits`, `quotes`, `changeOrders`, `teams`, `jobs`, `materials`,
`materialReservations`, `materialUsages`, `invoices`. 각 레코드는 평범한 JSON 객체 + `id`.

## 4대 리스크 탐지 로직 (detectors.js)

1. **추가 작업 승인 누락** `detectMissingApprovals` — changeOrder가 `approved` 상태이고 승인 시각이 자재사용 시각보다 앞서야 정상. 아니면 적발.
2. **자재 중복·초과 예약** `detectMaterialOverbooking` — 동일 자재+날짜의 예약 합계가 재고(`stockQty`)를 넘으면 적발. 같은 작업의 중복 입력도 별도 적발.
3. **작업팀 일정 충돌** `detectTeamConflicts` — 동일 팀에 배정된 두 작업의 시간 구간이 겹치면 적발.
4. **청구 누락·과소청구** `detectBillingGaps` — 완료(`completed`) 작업에 청구서(invoice)가 없거나, 있어도 금액이 승인된 범위(`견적 + 승인된 추가작업`)보다 적으면 적발.

대시보드/자재/작업팀/청구 화면은 모두 이 4개 함수를 실시간 데이터에 그대로 적용한다 — UI와 테스트가 로직을 공유하므로 "테스트는 통과했는데 화면은 다르다"는 괴리가 구조적으로 없다.

## 개발 시 주의사항

- **네이티브 다이얼로그 금지**: `window.prompt()`/`window.confirm()`은 사용하지 않는다. 이 앱은 Claude Artifact(iframe) 안에서도 열리는데, 그 환경에서 네이티브 다이얼로그가 차단되거나 불안정하게 동작하는 것을 실측으로 확인했다. 대신 `app.js`의 `confirmDialog()` / `promptDialog()` (커스텀 오버레이 모달)를 사용한다.
- **XSS 방지**: 사용자 입력(고객명, 주소, 설명 등)을 `innerHTML`에 꽂기 전에는 반드시 `esc()`로 이스케이프한다.
- **렌더링 방식**: 가상 DOM 없음. 상태가 바뀌면 해당 화면 전체를 문자열 템플릿으로 다시 그린다(`render()`). 폼 입력 중 리렌더가 필요한 경우(견적 품목 추가/삭제) DOM에서 현재 값을 먼저 읽어(`captureQuoteItemsFromDom()`) 유실을 막는다.
- **DB 폴백**: `store.js`는 `claude.use("db")`가 `null`이면 자동으로 `localStorage` + 내장 시드 데이터로 폴백한다. 로컬에서 `index.html`을 그냥 열어도(정적 서버만 있으면) 전체 기능이 동작해야 한다.

## 테스트

npm/node 없이 순수 브라우저에서 실행된다.

- 앱의 **테스트 결과** 메뉴(`#/tests`)에서 `tests.js`의 14개 단위 테스트(탐지기별 양성/음성 케이스)를 즉시 확인 가능.
- 로컬 정적 서버(아무 HTTP 서버)로 `index.html`을 띄우면 동일하게 동작 확인 가능. Node/Python이 없는 환경에서는 PowerShell의 `System.Net.HttpListener`로 간이 서버를 띄워도 된다.

## 배포

이 앱은 Claude Artifact로 게시되어 있으며 `db` capability(조직 내 공유 실시간 저장소)를 사용한다. 코드를 수정한 뒤에는 Claude의 Artifact 퍼블리시로 같은 URL에 재배포해야 실제 서비스에 반영된다 — 이 저장소에 커밋하는 것만으로는 배포되지 않는다.
