/* ===================================================================
 * app.js — 튼튼설비 운영 앱: 라우팅 + 화면 렌더링 + 이벤트 처리
 * =================================================================== */
(function () {
  "use strict";
  const D = window.Detectors;
  const S = window.Store;

  const $app = document.getElementById("app-main");
  const $nav = document.getElementById("nav-links");
  const $toast = document.getElementById("toast");

  const UI = {
    selectedInquiry: null,
    selectedJob: null,
    jobTab: "개요",
    showNewInquiry: false,
    showNewQuote: null, // inquiryId
    quoteItems: [{ desc: "", qty: 1, price: 0 }],
    showNewTeam: false,
    showNewMaterial: false,
    teamFilter: "",
    confirmState: null, // {message, onOk}
    promptState: null, // {message, value, onOk}
    showMoreMenu: false,
  };

  /* ---------------- utils ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function won(n) { return D.won(n); }
  function fmt(iso) { return D.fmt(iso); }
  function todayISODate() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  function toast(msg, kind) {
    $toast.textContent = msg;
    $toast.className = "toast show " + (kind || "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { $toast.className = "toast"; }, 2600);
  }
  function statusBadge(status) {
    const map = {
      new: ["신규", "neutral"], site_visit_scheduled: ["현장확인 예정", "info"],
      site_visit_done: ["현장확인 완료", "info"], quoted: ["견적 발송", "info"], closed: ["종결", "neutral"],
      draft: ["작성중", "neutral"], sent: ["승인대기", "warn"], approved: ["승인완료", "good"], rejected: ["반려", "danger"],
      pending: ["승인대기", "warn"],
      scheduled: ["예정", "info"], in_progress: ["진행중", "warn"], completed: ["완료", "good"], cancelled: ["취소", "danger"],
      unpaid: ["미수금", "warn"], paid: ["입금완료", "good"],
      done: ["완료", "good"],
    };
    const [label, kind] = map[status] || [status, "neutral"];
    return `<span class="badge badge-${kind}">${esc(label)}</span>`;
  }
  function sevBadge(sev) {
    return `<span class="sev sev-${sev}">${sev === "critical" ? "긴급" : "주의"}</span>`;
  }

  function confirmDialog(message, onOk) {
    UI.confirmState = { message, onOk };
    renderConfirm();
  }
  function renderConfirm() {
    const $c = document.getElementById("confirm-overlay");
    if (!UI.confirmState) { $c.classList.remove("show"); $c.innerHTML = ""; return; }
    $c.classList.add("show");
    $c.innerHTML = `
      <div class="confirm-box">
        <p>${esc(UI.confirmState.message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" data-action="confirm-cancel">취소</button>
          <button class="btn btn-danger" data-action="confirm-ok">확인하고 진행</button>
        </div>
      </div>`;
  }

  /* iframe 환경에서는 window.prompt/confirm이 차단되거나 동작이 불안정할 수 있어
   * 자체 모달로 대체한다 (승인자 이름 입력 등). */
  function promptDialog(message, defaultValue, onOk) {
    UI.promptState = { message, value: defaultValue || "", onOk };
    renderPrompt();
  }
  function renderPrompt() {
    const $c = document.getElementById("prompt-overlay");
    if (!UI.promptState) { $c.classList.remove("show"); $c.innerHTML = ""; return; }
    $c.classList.add("show");
    $c.innerHTML = `
      <form class="confirm-box" data-form="prompt-submit">
        <p>${esc(UI.promptState.message)}</p>
        <input type="text" id="prompt-input" value="${esc(UI.promptState.value)}" autofocus>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" data-action="prompt-cancel">취소</button>
          <button type="submit" class="btn btn-primary">확인</button>
        </div>
      </form>`;
    const input = document.getElementById("prompt-input");
    if (input) { input.focus(); input.select(); }
  }

  /* ---------------- 라우팅 ---------------- */
  const ROUTES = [
    { path: "", label: "대시보드", icon: "◎" },
    { path: "inquiries", label: "문의·견적", icon: "☎" },
    { path: "jobs", label: "작업배정", icon: "🛠" },
    { path: "materials", label: "자재", icon: "▦" },
    { path: "teams", label: "작업팀", icon: "◈" },
    { path: "billing", label: "청구·정산", icon: "₩" },
    { path: "tests", label: "테스트 결과", icon: "✓" },
  ];

  function currentPath() {
    const h = location.hash.replace(/^#\/?/, "");
    return h.split("/")[0] || "";
  }
  function renderNav() {
    $nav.innerHTML = ROUTES.map((r) => {
      const active = currentPath() === r.path;
      return `<a href="#/${r.path}" class="nav-link ${active ? "active" : ""}" data-nav="${r.path}">
        <span class="nav-icon">${r.icon}</span><span class="nav-label">${r.label}</span>
      </a>`;
    }).join("");
    const $tabbar = document.getElementById("tabbar");
    const mobileRoutes = ROUTES.slice(0, 5);
    $tabbar.innerHTML = mobileRoutes.map((r) => {
      const active = currentPath() === r.path;
      return `<a href="#/${r.path}" class="tabbar-link ${active ? "active" : ""}">
        <span class="nav-icon">${r.icon}</span><span>${r.label}</span>
      </a>`;
    }).join("") + `<a href="#" class="tabbar-link" data-action="more-menu"><span class="nav-icon">☰</span><span>더보기</span></a>`;
  }

  function render() {
    renderNav();
    const path = currentPath();
    if (path === "" ) $app.innerHTML = renderDashboard();
    else if (path === "inquiries") $app.innerHTML = renderInquiries();
    else if (path === "jobs") $app.innerHTML = renderJobs();
    else if (path === "materials") $app.innerHTML = renderMaterials();
    else if (path === "teams") $app.innerHTML = renderTeams();
    else if (path === "billing") $app.innerHTML = renderBilling();
    else if (path === "tests") $app.innerHTML = renderTests();
    else $app.innerHTML = renderDashboard();
    renderConfirm();
    renderPrompt();
    renderMoreMenu();
    window.scrollTo(0, 0);
  }

  function renderMoreMenu() {
    const $m = document.getElementById("more-menu");
    if (!UI.showMoreMenu) { $m.classList.remove("show"); $m.innerHTML = ""; return; }
    $m.classList.add("show");
    $m.innerHTML = `
      <a href="#/teams" data-action="close-more-menu">◈ 작업팀</a>
      <a href="#/tests" data-action="close-more-menu">✓ 테스트 결과</a>
    `;
  }

  window.addEventListener("hashchange", render);

  /* ---------------- 대시보드 ---------------- */
  function liveAlerts() {
    return D.runAllDetectors({
      jobs: S.list("jobs"), quotes: S.list("quotes"), changeOrders: S.list("changeOrders"),
      materialUsages: S.list("materialUsages"), materials: S.list("materials"),
      reservations: S.list("materialReservations"), teams: S.list("teams"), invoices: S.list("invoices"),
    });
  }

  function renderDashboard() {
    const alerts = liveAlerts();
    const critical = alerts.filter((a) => a.severity === "critical").length;
    const warn = alerts.filter((a) => a.severity === "warning").length;
    const inquiries = S.list("inquiries");
    const jobs = S.list("jobs");
    const openInquiries = inquiries.filter((i) => i.status !== "closed").length;
    const pendingApproval = S.list("quotes").filter((q) => q.status === "sent").length;
    const inProgress = jobs.filter((j) => j.status === "in_progress" || j.status === "scheduled").length;
    const unbilled = jobs.filter((j) => j.status === "completed" && !S.list("invoices").some((inv) => inv.jobId === j.id)).length;

    const groups = {
      missing_approval: { title: "① 추가 작업 승인 누락", items: alerts.filter((a) => a.type === "missing_approval") },
      material_overbooking: { title: "② 자재 중복(초과) 예약", items: alerts.filter((a) => a.type === "material_overbooking") },
      team_conflict: { title: "③ 작업팀 일정 충돌", items: alerts.filter((a) => a.type === "team_conflict") },
      billing_gap: { title: "④ 청구 누락·과소 청구", items: alerts.filter((a) => a.type === "billing_gap") },
    };

    return `
      <div class="page-head">
        <div>
          <h1>대시보드</h1>
          <p class="sub">튼튼설비 · 오늘 ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
        </div>
        <div class="mode-pill">${S.mode === "db" ? "● 저장소: 공유 DB (실시간 동기화)" : "● 저장소: 이 기기 로컬(데모 모드)"}</div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-num">${openInquiries}</div><div class="kpi-label">진행중 문의</div></div>
        <div class="kpi-card"><div class="kpi-num">${pendingApproval}</div><div class="kpi-label">고객 승인 대기 견적</div></div>
        <div class="kpi-card"><div class="kpi-num">${inProgress}</div><div class="kpi-label">예정·진행중 작업</div></div>
        <div class="kpi-card ${unbilled ? "kpi-danger" : ""}"><div class="kpi-num">${unbilled}</div><div class="kpi-label">완료됐지만 미청구</div></div>
      </div>

      <div class="alert-summary">
        <div class="alert-summary-item critical"><span class="dot"></span>긴급 ${critical}건</div>
        <div class="alert-summary-item warn"><span class="dot"></span>주의 ${warn}건</div>
        <div class="alert-summary-item">전체 리스크 룰 4종 상시 자동 점검 중</div>
      </div>

      <div class="risk-grid">
        ${Object.values(groups).map((g) => `
          <div class="risk-card">
            <h3>${g.title}</h3>
            ${g.items.length === 0
              ? `<p class="empty-ok">✓ 이상 없음</p>`
              : g.items.map((a) => `
                <div class="risk-item">
                  ${sevBadge(a.severity)}
                  <p>${esc(a.message)}</p>
                </div>`).join("")}
          </div>
        `).join("")}
      </div>
    `;
  }

  /* ---------------- 문의 · 견적 ---------------- */
  function renderInquiries() {
    const list = [...S.list("inquiries")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const sel = UI.selectedInquiry ? S.get("inquiries", UI.selectedInquiry) : null;

    return `
      <div class="page-head">
        <div><h1>문의 접수 · 견적</h1><p class="sub">문의 등록 → 현장 확인 → 견적 → 고객 승인까지 한 화면에서 처리합니다.</p></div>
        <button class="btn btn-primary" data-action="toggle-new-inquiry">+ 새 문의 접수</button>
      </div>

      ${UI.showNewInquiry ? `
      <form class="panel form-panel" data-form="new-inquiry">
        <h3>새 문의 등록</h3>
        <div class="grid-2">
          <label>고객명<input name="customerName" required placeholder="예: 박서연"></label>
          <label>연락처<input name="phone" required placeholder="010-0000-0000"></label>
        </div>
        <label>주소<input name="address" required placeholder="현장 주소"></label>
        <div class="grid-2">
          <label>접수 경로
            <select name="channel"><option>전화</option><option>온라인</option><option>방문</option><option>지인소개</option></select>
          </label>
          <label>&nbsp;</label>
        </div>
        <label>문의 내용<textarea name="description" required rows="3" placeholder="증상, 요청 사항을 적어주세요"></textarea></label>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-action="toggle-new-inquiry">취소</button>
          <button type="submit" class="btn btn-primary">등록</button>
        </div>
      </form>` : ""}

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>접수일</th><th>고객</th><th>주소</th><th>내용</th><th>경로</th><th>상태</th></tr></thead>
          <tbody>
            ${list.map((i) => `
              <tr class="clickable ${UI.selectedInquiry === i.id ? "row-active" : ""}" data-action="select-inquiry" data-id="${i.id}">
                <td class="mono">${fmt(i.createdAt)}</td>
                <td>${esc(i.customerName)}<div class="dim">${esc(i.phone)}</div></td>
                <td class="dim">${esc(i.address)}</td>
                <td class="ellipsis">${esc(i.description)}</td>
                <td>${esc(i.channel)}</td>
                <td>${statusBadge(i.status)}</td>
              </tr>`).join("") || `<tr><td colspan="6" class="empty">등록된 문의가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${sel ? renderInquiryDetail(sel) : ""}
    `;
  }

  function renderInquiryDetail(inq) {
    const visit = S.list("siteVisits").find((v) => v.inquiryId === inq.id);
    const quote = S.list("quotes").find((q) => q.inquiryId === inq.id);
    const job = quote ? S.list("jobs").find((j) => j.quoteId === quote.id) : null;

    return `
      <div class="panel detail-panel">
        <div class="detail-head">
          <h2>${esc(inq.customerName)} — ${esc(inq.address)}</h2>
          ${statusBadge(inq.status)}
        </div>
        <p class="dim">${esc(inq.description)}</p>

        <div class="stepper">
          <div class="step-block">
            <h4>① 현장 확인</h4>
            ${visit ? `
              <p>예정: <span class="mono">${fmt(visit.scheduledAt)}</span> ${statusBadge(visit.status)}</p>
              ${visit.memo ? `<p class="dim">메모: ${esc(visit.memo)}</p>` : ""}
              ${visit.status === "scheduled" ? `
                <form data-form="complete-visit" data-id="${visit.id}" data-inquiry="${inq.id}" class="inline-form">
                  <input name="memo" placeholder="현장 확인 결과 메모">
                  <button class="btn btn-sm btn-primary" type="submit">현장 확인 완료 처리</button>
                </form>` : ""}
            ` : `
              <form data-form="schedule-visit" data-id="${inq.id}" class="inline-form">
                <input type="datetime-local" name="scheduledAt" required>
                <button class="btn btn-sm btn-primary" type="submit">현장 확인 예약</button>
              </form>`}
          </div>

          <div class="step-block">
            <h4>② 견적 작성 · 고객 승인</h4>
            ${quote ? renderQuoteBlock(quote) : (
              visit && visit.status === "done" ? `
              <button class="btn btn-sm btn-primary" data-action="open-new-quote" data-id="${inq.id}">견적서 작성</button>
              ` : `<p class="dim">현장 확인 완료 후 견적을 작성할 수 있습니다.</p>`
            )}
            ${UI.showNewQuote === inq.id ? renderQuoteForm(inq) : ""}
          </div>

          <div class="step-block">
            <h4>③ 작업 배정</h4>
            ${job
              ? `<p>배정됨 → <a href="#/jobs" data-action="goto-job" data-id="${job.id}">${esc(job.title)} 보기</a> ${statusBadge(job.status)}</p>`
              : quote && quote.status === "approved"
                ? `<form data-form="create-job" data-quote="${quote.id}" data-inquiry="${inq.id}" class="inline-form-col">
                    <select name="teamId" required><option value="">작업팀 선택</option>${S.list("teams").map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>
                    <div class="grid-2">
                      <input type="datetime-local" name="scheduledStart" required>
                      <input type="datetime-local" name="scheduledEnd" required>
                    </div>
                    <button class="btn btn-sm btn-primary" type="submit">작업 생성 및 배정</button>
                  </form>`
                : `<p class="dim">고객 승인이 완료되면 작업을 배정할 수 있습니다.</p>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderQuoteBlock(q) {
    return `
      <div class="quote-box">
        <table class="mini-table">
          <thead><tr><th>품목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
          <tbody>
            ${q.items.map((it) => `<tr><td>${esc(it.desc)}</td><td>${it.qty}</td><td class="mono">${won(it.unitPrice)}</td><td class="mono">${won(it.qty * it.unitPrice)}</td></tr>`).join("")}
          </tbody>
          <tfoot><tr><td colspan="3">합계</td><td class="mono">${won(q.total)}</td></tr></tfoot>
        </table>
        <div class="quote-status">
          ${statusBadge(q.status)}
          ${q.status === "approved" ? `<span class="dim">승인: ${esc(q.approvedBy || "")} · ${fmt(q.approvedAt)}</span>` : ""}
        </div>
        <div class="form-actions">
          ${q.status === "draft" ? `<button class="btn btn-sm btn-primary" data-action="send-quote" data-id="${q.id}">고객에게 견적 발송</button>` : ""}
          ${q.status === "sent" ? `
            <button class="btn btn-sm btn-primary" data-action="approve-quote" data-id="${q.id}">고객 승인 접수</button>
            <button class="btn btn-sm btn-ghost" data-action="reject-quote" data-id="${q.id}">반려 처리</button>` : ""}
        </div>
      </div>
    `;
  }

  function renderQuoteForm(inq) {
    return `
      <form class="panel form-panel" data-form="create-quote" data-id="${inq.id}">
        <h4>견적 항목</h4>
        <div class="quote-items">
          ${UI.quoteItems.map((it, idx) => `
            <div class="quote-item-row">
              <input name="desc[]" placeholder="품목/작업 내용" value="${esc(it.desc)}" required>
              <input name="qty[]" type="number" min="1" step="1" placeholder="수량" value="${it.qty}" required>
              <input name="price[]" type="number" min="0" step="1000" placeholder="단가" value="${it.price}" required>
              <button type="button" class="btn btn-icon" data-action="remove-quote-item" data-idx="${idx}" ${UI.quoteItems.length <= 1 ? "disabled" : ""}>✕</button>
            </div>
          `).join("")}
        </div>
        <button type="button" class="btn btn-sm btn-ghost" data-action="add-quote-item">+ 품목 추가</button>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel-new-quote">취소</button>
          <button type="submit" class="btn btn-primary">견적서 저장</button>
        </div>
      </form>
    `;
  }

  function captureQuoteItemsFromDom() {
    const rows = $app.querySelectorAll(".quote-item-row");
    if (!rows.length) return;
    const items = [];
    rows.forEach((row) => {
      items.push({
        desc: row.querySelector('[name="desc[]"]').value,
        qty: row.querySelector('[name="qty[]"]').value || 1,
        price: row.querySelector('[name="price[]"]').value || 0,
      });
    });
    UI.quoteItems = items;
  }

  /* ---------------- 작업배정 ---------------- */
  function renderJobs() {
    let list = [...S.list("jobs")].sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
    if (UI.teamFilter) list = list.filter((j) => j.teamId === UI.teamFilter);
    const conflicts = D.detectTeamConflicts({ jobs: S.list("jobs"), teams: S.list("teams") });
    const conflictJobIds = new Set(conflicts.flatMap((c) => [c.jobA.id, c.jobB.id]));
    const sel = UI.selectedJob ? S.get("jobs", UI.selectedJob) : null;

    return `
      <div class="page-head">
        <div><h1>작업 배정</h1><p class="sub">작업팀 일정, 자재 예약·사용, 추가 작업 승인, 완료 처리를 관리합니다.</p></div>
        <select id="team-filter" class="select-filter">
          <option value="">전체 작업팀</option>
          ${S.list("teams").map((t) => `<option value="${t.id}" ${UI.teamFilter === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
        </select>
      </div>

      ${conflicts.length ? `<div class="inline-alert danger">⚠ 일정 충돌 ${conflicts.length}건이 감지되었습니다. 아래 표에서 <span class="conflict-mark">붉은 표시</span>를 확인하세요.</div>` : ""}

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>작업</th><th>고객</th><th>작업팀</th><th>일정</th><th>상태</th></tr></thead>
          <tbody>
            ${list.map((j) => `
              <tr class="clickable ${UI.selectedJob === j.id ? "row-active" : ""} ${conflictJobIds.has(j.id) ? "row-conflict" : ""}" data-action="select-job" data-id="${j.id}">
                <td>${esc(j.title)}</td>
                <td>${esc(j.customerName)}</td>
                <td>${esc((S.get("teams", j.teamId) || {}).name || "미배정")}</td>
                <td class="mono">${fmt(j.scheduledStart)} ~ ${fmt(j.scheduledEnd)} ${conflictJobIds.has(j.id) ? '<span class="conflict-mark">충돌</span>' : ""}</td>
                <td>${statusBadge(j.status)}</td>
              </tr>`).join("") || `<tr><td colspan="5" class="empty">배정된 작업이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${sel ? renderJobDetail(sel) : ""}
    `;
  }

  function renderJobDetail(job) {
    const quote = S.get("quotes", job.quoteId);
    const changeOrders = S.list("changeOrders").filter((c) => c.jobId === job.id);
    const reservations = S.list("materialReservations").filter((r) => r.jobId === job.id);
    const usages = S.list("materialUsages").filter((u) => u.jobId === job.id);
    const invoice = S.list("invoices").find((inv) => inv.jobId === job.id);
    const scope = D.committedScope(quote, changeOrders);
    const materials = S.list("materials");

    const tabs = ["개요", "자재예약", "자재사용", "추가작업", "정산"];

    function tabBtn(t) {
      return `<button class="tab-btn ${UI.jobTab === t ? "active" : ""}" data-action="switch-tab" data-tab="${t}">${t}</button>`;
    }

    let body = "";
    if (UI.jobTab === "개요") {
      const myConflicts = D.detectTeamConflicts({ jobs: S.list("jobs"), teams: S.list("teams") })
        .filter((c) => c.jobA.id === job.id || c.jobB.id === job.id);
      body = `
        <div class="grid-2">
          <div><span class="dim">고객</span><p>${esc(job.customerName)}</p></div>
          <div><span class="dim">작업팀</span><p>${esc((S.get("teams", job.teamId) || {}).name || "-")}</p></div>
        </div>
        ${myConflicts.length ? `<div class="inline-alert danger">⚠ ${esc(myConflicts[0].message)}</div>` : ""}
        <form data-form="edit-schedule" data-id="${job.id}" class="inline-form-col">
          <label>작업팀
            <select name="teamId">${S.list("teams").map((t) => `<option value="${t.id}" ${t.id === job.teamId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
          </label>
          <div class="grid-2">
            <label>시작<input type="datetime-local" name="scheduledStart" value="${job.scheduledStart}"></label>
            <label>종료<input type="datetime-local" name="scheduledEnd" value="${job.scheduledEnd}"></label>
          </div>
          <div class="form-actions">
            <button class="btn btn-sm btn-primary" type="submit">일정 저장</button>
            ${job.status !== "completed" ? `<button type="button" class="btn btn-sm btn-primary" data-action="mark-complete" data-id="${job.id}">작업 완료 처리</button>` : ""}
          </div>
        </form>
      `;
    } else if (UI.jobTab === "자재예약") {
      body = `
        <form data-form="reserve-material" data-id="${job.id}" class="inline-form">
          <select name="materialId" required>${materials.map((m) => `<option value="${m.id}">${esc(m.name)} (재고 ${m.stockQty}${m.unit})</option>`).join("")}</select>
          <input type="number" name="qty" min="1" placeholder="수량" required>
          <input type="date" name="date" value="${job.scheduledStart.slice(0, 10)}" required>
          <button class="btn btn-sm btn-primary" type="submit">예약</button>
        </form>
        <table class="mini-table">
          <thead><tr><th>자재</th><th>수량</th><th>날짜</th></tr></thead>
          <tbody>${reservations.map((r) => `<tr><td>${esc((S.get("materials", r.materialId) || {}).name || r.materialId)}</td><td>${r.qty}</td><td class="mono">${r.date}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">예약된 자재가 없습니다.</td></tr>`}</tbody>
        </table>
      `;
    } else if (UI.jobTab === "자재사용") {
      body = `
        <form data-form="log-usage" data-id="${job.id}" class="inline-form-col">
          <div class="grid-2">
            <select name="materialId" required>${materials.map((m) => `<option value="${m.id}">${esc(m.name)} (${won(m.unitCost)}/${m.unit})</option>`).join("")}</select>
            <input type="number" name="qty" min="1" placeholder="수량" required>
          </div>
          <label>연결된 추가작업 (해당 시 선택 — 견적 범위 내 사용은 비워두세요)
            <select name="changeOrderId">
              <option value="">— 견적 범위 내 —</option>
              ${changeOrders.map((c) => `<option value="${c.id}">${esc(c.description)} (${statusBadge(c.status).replace(/<[^>]+>/g, "")})</option>`).join("")}
            </select>
          </label>
          <button class="btn btn-sm btn-primary" type="submit">사용 등록</button>
        </form>
        <table class="mini-table">
          <thead><tr><th>자재</th><th>수량</th><th>금액</th><th>사용시각</th><th>추가작업 연결</th></tr></thead>
          <tbody>${usages.map((u) => {
            const co = changeOrders.find((c) => c.id === u.changeOrderId);
            const flagged = u.changeOrderId && (!co || co.status !== "approved" || (co.approvedAt && new Date(u.usedAt) < new Date(co.approvedAt)));
            return `<tr class="${flagged ? "row-conflict" : ""}"><td>${esc((S.get("materials", u.materialId) || {}).name || u.materialId)}</td><td>${u.qty}</td><td class="mono">${won(u.cost)}</td><td class="mono">${fmt(u.usedAt)}</td><td>${co ? esc(co.description) + (flagged ? ' <span class="conflict-mark">승인전</span>' : "") : "-"}</td></tr>`;
          }).join("") || `<tr><td colspan="5" class="empty">등록된 자재 사용이 없습니다.</td></tr>`}</tbody>
        </table>
      `;
    } else if (UI.jobTab === "추가작업") {
      body = `
        <form data-form="create-change-order" data-id="${job.id}" class="inline-form">
          <input name="description" placeholder="추가 작업 내용" required>
          <input type="number" name="amount" min="0" step="1000" placeholder="금액" required>
          <button class="btn btn-sm btn-primary" type="submit">추가작업 요청 등록</button>
        </form>
        <table class="mini-table">
          <thead><tr><th>내용</th><th>금액</th><th>상태</th><th>승인</th><th></th></tr></thead>
          <tbody>${changeOrders.map((c) => `
            <tr>
              <td>${esc(c.description)}</td><td class="mono">${won(c.amount)}</td><td>${statusBadge(c.status)}</td>
              <td class="dim">${c.approvedAt ? fmt(c.approvedAt) + " · " + esc(c.approvedBy || "") : "-"}</td>
              <td>${c.status === "pending" ? `
                <button class="btn btn-xs btn-primary" data-action="approve-change-order" data-id="${c.id}">고객 승인 접수</button>
                <button class="btn btn-xs btn-ghost" data-action="reject-change-order" data-id="${c.id}">반려</button>` : ""}</td>
            </tr>`).join("") || `<tr><td colspan="5" class="empty">등록된 추가작업 요청이 없습니다.</td></tr>`}</tbody>
        </table>
      `;
    } else if (UI.jobTab === "정산") {
      body = `
        <div class="scope-box">
          <div><span class="dim">견적 금액</span><p class="mono">${won(quote ? quote.total : 0)}</p></div>
          <div><span class="dim">승인된 추가작업</span><p class="mono">${won(scope - (quote ? quote.total : 0))}</p></div>
          <div><span class="dim">청구 대상 총액</span><p class="mono strong">${won(scope)}</p></div>
        </div>
        ${invoice ? `
          <div class="quote-box">
            <p>청구액 <span class="mono strong">${won(invoice.amount)}</span> ${statusBadge(invoice.status)}</p>
            <p class="dim">발행: ${fmt(invoice.issuedAt)} · 만기: ${esc(invoice.dueDate)}</p>
            ${invoice.amount < scope ? `<div class="inline-alert warn">⚠ 청구액이 승인 범위보다 ${won(scope - invoice.amount)} 적습니다. 추가 청구가 필요할 수 있습니다.</div>` : ""}
            ${invoice.status === "unpaid" ? `<button class="btn btn-sm btn-primary" data-action="mark-paid" data-id="${invoice.id}">입금 확인 처리</button>` : ""}
          </div>
        ` : job.status === "completed" ? `
          <div class="inline-alert danger">⚠ 작업이 완료되었지만 아직 청구서가 발행되지 않았습니다.</div>
          <form data-form="create-invoice" data-id="${job.id}" class="inline-form">
            <input type="number" name="amount" value="${scope}" min="0" step="1000" required>
            <input type="date" name="dueDate" value="${todayISODate()}" required>
            <button class="btn btn-sm btn-primary" type="submit">청구서 발행</button>
          </form>
        ` : `<p class="dim">작업 완료 후 청구서를 발행할 수 있습니다.</p>`}
      `;
    }

    return `
      <div class="panel detail-panel">
        <div class="detail-head"><h2>${esc(job.title)}</h2>${statusBadge(job.status)}</div>
        <div class="tab-bar">${tabs.map(tabBtn).join("")}</div>
        <div class="tab-body">${body}</div>
      </div>
    `;
  }

  /* ---------------- 자재 ---------------- */
  function renderMaterials() {
    const materials = S.list("materials");
    const reservations = S.list("materialReservations");
    const overAlerts = D.detectMaterialOverbooking({ materials, reservations });

    const byMatDate = new Map();
    for (const r of reservations) {
      const key = `${r.materialId}|${r.date}`;
      byMatDate.set(key, (byMatDate.get(key) || 0) + r.qty);
    }

    return `
      <div class="page-head">
        <div><h1>자재</h1><p class="sub">재고와 예약 현황을 관리합니다. 같은 날짜에 예약 합계가 재고를 넘으면 자동으로 표시됩니다.</p></div>
        <button class="btn btn-primary" data-action="toggle-new-material">+ 자재 등록</button>
      </div>

      ${UI.showNewMaterial ? `
      <form class="panel form-panel" data-form="new-material">
        <div class="grid-2">
          <label>자재명<input name="name" required></label>
          <label>단위<input name="unit" required placeholder="개 / m / 롤 / 대"></label>
        </div>
        <div class="grid-2">
          <label>재고 수량<input name="stockQty" type="number" min="0" required></label>
          <label>단가<input name="unitCost" type="number" min="0" step="500" required></label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-action="toggle-new-material">취소</button>
          <button type="submit" class="btn btn-primary">등록</button>
        </div>
      </form>` : ""}

      ${overAlerts.length ? `<div class="inline-alert danger">⚠ 자재 초과·중복 예약 ${overAlerts.length}건 감지</div>` : ""}

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>자재명</th><th>단위</th><th>재고</th><th>단가</th><th>예약 현황(날짜별 합계)</th></tr></thead>
          <tbody>
            ${materials.map((m) => {
              const rows = [...byMatDate.entries()].filter(([k]) => k.startsWith(m.id + "|"));
              return `<tr>
                <td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="mono">${m.stockQty}</td><td class="mono">${won(m.unitCost)}</td>
                <td>${rows.length ? rows.map(([k, qty]) => {
                  const date = k.split("|")[1];
                  const over = qty > m.stockQty;
                  return `<span class="chip ${over ? "chip-danger" : ""}">${date}: ${qty}${m.unit}${over ? " ⚠" : ""}</span>`;
                }).join(" ") : '<span class="dim">-</span>'}</td>
              </tr>`;
            }).join("") || `<tr><td colspan="5" class="empty">등록된 자재가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${overAlerts.length ? `
      <div class="panel">
        <h3>초과·중복 예약 상세</h3>
        ${overAlerts.map((a) => `<div class="risk-item">${sevBadge(a.severity)}<p>${esc(a.message)}</p></div>`).join("")}
      </div>` : ""}
    `;
  }

  /* ---------------- 작업팀 ---------------- */
  function renderTeams() {
    const teams = S.list("teams");
    const jobs = S.list("jobs");
    const conflicts = D.detectTeamConflicts({ jobs, teams });

    return `
      <div class="page-head">
        <div><h1>작업팀</h1><p class="sub">팀별 일정과 충돌 여부를 확인합니다.</p></div>
        <button class="btn btn-primary" data-action="toggle-new-team">+ 팀 등록</button>
      </div>

      ${UI.showNewTeam ? `
      <form class="panel form-panel" data-form="new-team">
        <div class="grid-2">
          <label>팀 이름<input name="name" required placeholder="예: 3팀 (홍반장)"></label>
          <label>팀원<input name="members" placeholder="이름을 콤마로 구분"></label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-action="toggle-new-team">취소</button>
          <button type="submit" class="btn btn-primary">등록</button>
        </div>
      </form>` : ""}

      ${teams.map((t) => {
        const myJobs = jobs.filter((j) => j.teamId === t.id).sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
        const myConflicts = conflicts.filter((c) => c.teamId === t.id);
        return `
          <div class="panel">
            <div class="detail-head"><h2>${esc(t.name)}</h2><span class="dim">${esc(t.members || "")}</span></div>
            ${myConflicts.length ? `<div class="inline-alert danger">⚠ ${myConflicts.map((c) => esc(c.message)).join("<br>")}</div>` : ""}
            <table class="mini-table">
              <thead><tr><th>작업</th><th>고객</th><th>일정</th><th>상태</th></tr></thead>
              <tbody>${myJobs.map((j) => `<tr><td>${esc(j.title)}</td><td>${esc(j.customerName)}</td><td class="mono">${fmt(j.scheduledStart)} ~ ${fmt(j.scheduledEnd)}</td><td>${statusBadge(j.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">배정된 작업 없음</td></tr>`}</tbody>
            </table>
          </div>`;
      }).join("")}
    `;
  }

  /* ---------------- 청구 · 정산 ---------------- */
  function renderBilling() {
    const jobs = S.list("jobs");
    const invoices = S.list("invoices");
    const gaps = D.detectBillingGaps({ jobs, quotes: S.list("quotes"), changeOrders: S.list("changeOrders"), invoices });

    return `
      <div class="page-head">
        <div><h1>청구 · 정산</h1><p class="sub">완료된 작업의 청구 누락·과소 청구를 자동으로 점검합니다.</p></div>
      </div>

      ${gaps.length ? `
      <div class="panel">
        <h3>⚠ 확인이 필요한 건 (${gaps.length})</h3>
        ${gaps.map((g) => `
          <div class="risk-item">
            ${sevBadge(g.severity)}<p>${esc(g.message)}</p>
            <button class="btn btn-xs btn-primary" data-action="goto-job-billing" data-id="${g.jobId}">청구서 발행하러 가기</button>
          </div>
        `).join("")}
      </div>` : `<div class="panel"><p class="empty-ok">✓ 청구 누락 없이 모두 정산되었습니다.</p></div>`}

      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>발행일</th><th>작업</th><th>고객</th><th>금액</th><th>만기</th><th>상태</th><th></th></tr></thead>
          <tbody>
            ${invoices.map((inv) => {
              const job = S.get("jobs", inv.jobId);
              return `<tr>
                <td class="mono">${fmt(inv.issuedAt)}</td>
                <td>${esc(job ? job.title : inv.jobId)}</td>
                <td>${esc(job ? job.customerName : "-")}</td>
                <td class="mono">${won(inv.amount)}</td>
                <td class="mono">${esc(inv.dueDate)}</td>
                <td>${statusBadge(inv.status)}</td>
                <td>${inv.status === "unpaid" ? `<button class="btn btn-xs btn-primary" data-action="mark-paid" data-id="${inv.id}">입금 확인</button>` : ""}</td>
              </tr>`;
            }).join("") || `<tr><td colspan="7" class="empty">발행된 청구서가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ---------------- 테스트 결과 ---------------- */
  function renderTests() {
    const results = window.TestResults || [];
    const summary = window.TestSummary || { total: 0, passed: 0, failed: 0 };
    const bySuite = {};
    for (const r of results) {
      bySuite[r.suite] = bySuite[r.suite] || [];
      bySuite[r.suite].push(r);
    }
    const live = liveAlerts();
    const liveBySeverity = {
      critical: live.filter((a) => a.severity === "critical").length,
      warning: live.filter((a) => a.severity === "warning").length,
    };

    return `
      <div class="page-head">
        <div><h1>테스트 결과</h1><p class="sub">리스크 탐지 로직(detectors.js)에 대한 자체 단위 테스트 결과입니다. 페이지 로드 시 자동 실행됩니다.</p></div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card ${summary.failed ? "kpi-danger" : "kpi-good"}"><div class="kpi-num">${summary.passed}/${summary.total}</div><div class="kpi-label">테스트 통과</div></div>
        <div class="kpi-card"><div class="kpi-num">${liveBySeverity.critical}</div><div class="kpi-label">현재 데이터 · 긴급 알림</div></div>
        <div class="kpi-card"><div class="kpi-num">${liveBySeverity.warning}</div><div class="kpi-label">현재 데이터 · 주의 알림</div></div>
      </div>

      ${Object.entries(bySuite).map(([suite, items]) => `
        <div class="panel">
          <h3>${esc(suite)} <span class="dim">(${items.filter((i) => i.pass).length}/${items.length} 통과)</span></h3>
          ${items.map((r) => `
            <div class="test-row ${r.pass ? "pass" : "fail"}">
              <span class="test-icon">${r.pass ? "✓" : "✕"}</span>
              <span>${esc(r.name)}</span>
              ${!r.pass ? `<span class="test-error">${esc(r.error)}</span>` : ""}
            </div>
          `).join("")}
        </div>
      `).join("")}

      <div class="panel">
        <h3>테스트 범위 안내</h3>
        <ul class="note-list">
          <li>각 탐지기마다 "적발되어야 하는 경우(양성)"와 "정상 처리라 넘어가야 하는 경우(음성, 오탐 방지)"를 함께 검증합니다.</li>
          <li>대시보드/자재/작업팀/청구 화면의 경고는 지금 이 데이터(시드 또는 실제 입력값)에 동일한 탐지 함수를 실시간으로 적용한 결과입니다 — 테스트와 실제 화면이 같은 로직을 공유합니다.</li>
        </ul>
      </div>
    `;
  }

  /* ---------------- 이벤트 위임 ---------------- */
  document.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) { UI.selectedInquiry = null; UI.selectedJob = null; return; }

    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;

    if (action === "toggle-new-inquiry") { UI.showNewInquiry = !UI.showNewInquiry; render(); return; }
    if (action === "toggle-new-material") { UI.showNewMaterial = !UI.showNewMaterial; render(); return; }
    if (action === "toggle-new-team") { UI.showNewTeam = !UI.showNewTeam; render(); return; }
    if (action === "select-inquiry") { UI.selectedInquiry = UI.selectedInquiry === id ? null : id; UI.showNewQuote = null; render(); return; }
    if (action === "select-job") { UI.selectedJob = UI.selectedJob === id ? null : id; UI.jobTab = "개요"; render(); return; }
    if (action === "switch-tab") { UI.jobTab = t.dataset.tab; render(); return; }
    if (action === "goto-job") { location.hash = "#/jobs"; UI.selectedJob = id; render(); return; }
    if (action === "goto-job-billing") { location.hash = "#/jobs"; UI.selectedJob = id; UI.jobTab = "정산"; render(); return; }

    if (action === "open-new-quote") { UI.showNewQuote = id; UI.quoteItems = [{ desc: "", qty: 1, price: 0 }]; render(); return; }
    if (action === "cancel-new-quote") { UI.showNewQuote = null; render(); return; }
    if (action === "add-quote-item") { captureQuoteItemsFromDom(); UI.quoteItems.push({ desc: "", qty: 1, price: 0 }); render(); return; }
    if (action === "remove-quote-item") {
      captureQuoteItemsFromDom();
      UI.quoteItems.splice(Number(t.dataset.idx), 1);
      if (!UI.quoteItems.length) UI.quoteItems = [{ desc: "", qty: 1, price: 0 }];
      render(); return;
    }

    if (action === "send-quote") { await S.update("quotes", id, { status: "sent", sentAt: new Date().toISOString() }); toast("견적을 발송 처리했습니다."); return; }
    if (action === "approve-quote") {
      const q = S.get("quotes", id);
      promptDialog("고객 승인자 이름을 입력하세요 (전화/문자로 확인)", q.customerName, async (name) => {
        await S.update("quotes", id, { status: "approved", approvedAt: new Date().toISOString(), approvedBy: name + "(고객)" });
        await S.update("inquiries", q.inquiryId, { status: "quoted" });
        toast("고객 승인이 접수되었습니다.", "good");
      });
      return;
    }
    if (action === "reject-quote") { await S.update("quotes", id, { status: "rejected" }); toast("견적을 반려 처리했습니다.", "warn"); return; }

    if (action === "approve-change-order") {
      promptDialog("고객 승인자 이름을 입력하세요 (전화/문자로 확인)", "", async (name) => {
        await S.update("changeOrders", id, { status: "approved", approvedAt: new Date().toISOString(), approvedBy: name + "(고객)" });
        toast("추가 작업이 승인 처리되었습니다.", "good");
      });
      return;
    }
    if (action === "reject-change-order") { await S.update("changeOrders", id, { status: "rejected" }); toast("추가 작업 요청을 반려했습니다.", "warn"); return; }

    if (action === "mark-complete") {
      await S.update("jobs", id, { status: "completed", completedAt: new Date().toISOString() });
      toast("작업을 완료 처리했습니다.", "good"); return;
    }
    if (action === "mark-paid") { await S.update("invoices", id, { status: "paid", paidAt: new Date().toISOString() }); toast("입금 확인 처리했습니다.", "good"); return; }

    if (action === "confirm-cancel") { UI.confirmState = null; renderConfirm(); return; }
    if (action === "confirm-ok") {
      const fn = UI.confirmState && UI.confirmState.onOk;
      UI.confirmState = null; renderConfirm();
      if (fn) await fn();
      return;
    }

    if (action === "prompt-cancel") { UI.promptState = null; renderPrompt(); return; }

    if (action === "more-menu") {
      e.preventDefault();
      UI.showMoreMenu = !UI.showMoreMenu;
      renderMoreMenu();
      return;
    }
    if (action === "close-more-menu") { UI.showMoreMenu = false; renderMoreMenu(); return; }
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const type = form.dataset.form;
    const fd = new FormData(form);

    if (type === "prompt-submit") {
      const val = document.getElementById("prompt-input").value.trim();
      const fn = UI.promptState && UI.promptState.onOk;
      UI.promptState = null; renderPrompt();
      if (fn && val) await fn(val);
      return;
    }

    if (type === "new-inquiry") {
      const customerId = await S.add("customers", {
        name: fd.get("customerName"), phone: fd.get("phone"), address: fd.get("address"), memo: "", createdAt: new Date().toISOString(),
      });
      await S.add("inquiries", {
        customerId, customerName: fd.get("customerName"), phone: fd.get("phone"), address: fd.get("address"),
        description: fd.get("description"), channel: fd.get("channel"), status: "new", createdAt: new Date().toISOString(),
      });
      UI.showNewInquiry = false; toast("문의가 등록되었습니다.", "good"); return;
    }

    if (type === "schedule-visit") {
      await S.add("siteVisits", { inquiryId: form.dataset.id, scheduledAt: fd.get("scheduledAt"), memo: "", status: "scheduled" });
      await S.update("inquiries", form.dataset.id, { status: "site_visit_scheduled" });
      toast("현장 확인 일정이 등록되었습니다.", "good"); return;
    }

    if (type === "complete-visit") {
      await S.update("siteVisits", form.dataset.id, { status: "done", doneAt: new Date().toISOString(), memo: fd.get("memo") });
      await S.update("inquiries", form.dataset.inquiry, { status: "site_visit_done" });
      toast("현장 확인이 완료 처리되었습니다.", "good"); return;
    }

    if (type === "create-quote") {
      const descs = fd.getAll("desc[]"), qtys = fd.getAll("qty[]"), prices = fd.getAll("price[]");
      const items = descs.map((d, i) => ({ desc: d, qty: Number(qtys[i]) || 1, unitPrice: Number(prices[i]) || 0 }));
      const total = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
      const inq = S.get("inquiries", form.dataset.id);
      await S.add("quotes", {
        inquiryId: inq.id, customerId: inq.customerId, customerName: inq.customerName, items, total,
        status: "draft", createdAt: new Date().toISOString(),
      });
      await S.update("inquiries", inq.id, { status: "quoted" });
      UI.showNewQuote = null; toast("견적서가 저장되었습니다.", "good"); return;
    }

    if (type === "create-job") {
      const quoteId = form.dataset.quote, inquiryId = form.dataset.inquiry;
      const quote = S.get("quotes", quoteId);
      const teamId = fd.get("teamId"), scheduledStart = fd.get("scheduledStart"), scheduledEnd = fd.get("scheduledEnd");

      const doCreate = async () => {
        await S.add("jobs", {
          quoteId, inquiryId, customerId: quote.customerId, customerName: quote.customerName,
          title: `${quote.customerName} 작업`, teamId, scheduledStart, scheduledEnd,
          status: "scheduled", createdAt: new Date().toISOString(),
        });
        toast("작업이 배정되었습니다.", "good");
      };

      const conflict = findScheduleConflict(teamId, scheduledStart, scheduledEnd, null);
      if (conflict) {
        confirmDialog(`선택한 시간대에 이미 "${conflict.title}" 작업이 같은 팀에 배정되어 있습니다. 그래도 배정하시겠습니까?`, doCreate);
      } else {
        await doCreate();
      }
      return;
    }

    if (type === "edit-schedule") {
      const jobId = form.dataset.id;
      const teamId = fd.get("teamId"), scheduledStart = fd.get("scheduledStart"), scheduledEnd = fd.get("scheduledEnd");
      const doSave = async () => { await S.update("jobs", jobId, { teamId, scheduledStart, scheduledEnd }); toast("일정이 저장되었습니다.", "good"); };
      const conflict = findScheduleConflict(teamId, scheduledStart, scheduledEnd, jobId);
      if (conflict) {
        confirmDialog(`선택한 시간대에 이미 "${conflict.title}" 작업이 같은 팀에 배정되어 있습니다. 그래도 저장하시겠습니까?`, doSave);
      } else {
        await doSave();
      }
      return;
    }

    if (type === "reserve-material") {
      const jobId = form.dataset.id;
      const materialId = fd.get("materialId"), qty = Number(fd.get("qty")), date = fd.get("date");
      const material = S.get("materials", materialId);
      const existing = S.list("materialReservations").filter((r) => r.materialId === materialId && r.date === date && r.jobId !== jobId);
      const already = existing.reduce((s, r) => s + r.qty, 0);

      const doReserve = async () => { await S.add("materialReservations", { jobId, materialId, qty, date, createdAt: new Date().toISOString() }); toast("자재가 예약되었습니다.", "good"); };
      if (already + qty > material.stockQty) {
        confirmDialog(`"${material.name}"의 ${date} 예약 합계가 재고(${material.stockQty}${material.unit})를 초과합니다 (예약 시도 후 합계 ${already + qty}${material.unit}). 그래도 예약하시겠습니까?`, doReserve);
      } else {
        await doReserve();
      }
      return;
    }

    if (type === "log-usage") {
      const jobId = form.dataset.id;
      const materialId = fd.get("materialId"), qty = Number(fd.get("qty")), changeOrderId = fd.get("changeOrderId") || null;
      const material = S.get("materials", materialId);
      await S.add("materialUsages", { jobId, materialId, qty, cost: material.unitCost * qty, usedAt: new Date().toISOString(), changeOrderId, note: "" });
      toast("자재 사용이 등록되었습니다.", "good"); return;
    }

    if (type === "create-change-order") {
      await S.add("changeOrders", { jobId: form.dataset.id, description: fd.get("description"), amount: Number(fd.get("amount")), status: "pending", createdAt: new Date().toISOString(), approvedAt: null });
      toast("추가 작업 요청이 등록되었습니다. 고객 승인 후 시공해주세요.", "warn"); return;
    }

    if (type === "create-invoice") {
      const job = S.get("jobs", form.dataset.id);
      await S.add("invoices", { jobId: job.id, quoteId: job.quoteId, amount: Number(fd.get("amount")), issuedAt: new Date().toISOString(), dueDate: fd.get("dueDate"), status: "unpaid" });
      toast("청구서가 발행되었습니다.", "good"); return;
    }

    if (type === "new-material") {
      await S.add("materials", { name: fd.get("name"), unit: fd.get("unit"), stockQty: Number(fd.get("stockQty")), unitCost: Number(fd.get("unitCost")) });
      UI.showNewMaterial = false; toast("자재가 등록되었습니다.", "good"); return;
    }

    if (type === "new-team") {
      await S.add("teams", { name: fd.get("name"), members: fd.get("members") });
      UI.showNewTeam = false; toast("작업팀이 등록되었습니다.", "good"); return;
    }
  });

  function findScheduleConflict(teamId, start, end, excludeJobId) {
    if (!teamId || !start || !end) return null;
    const s = new Date(start).getTime(), e = new Date(end).getTime();
    return S.list("jobs").find((j) => {
      if (j.id === excludeJobId || j.teamId !== teamId || j.status === "cancelled") return false;
      const js = new Date(j.scheduledStart).getTime(), je = new Date(j.scheduledEnd).getTime();
      return s < je && js < e;
    }) || null;
  }

  document.addEventListener("change", (e) => {
    if (e.target.id === "team-filter") { UI.teamFilter = e.target.value; render(); }
  });

  /* ---------------- 부팅 ---------------- */
  S.onChange(render);
  S.init().then(render);
})();
