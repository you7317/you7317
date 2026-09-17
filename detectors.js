/* ===================================================================
 * detectors.js
 * 4대 리스크 탐지 엔진 (순수 함수) — 배관 설비 워크플로우
 *   1) 추가 작업 승인 누락   detectMissingApprovals
 *   2) 자재 중복 예약(초과)  detectMaterialOverbooking
 *   3) 작업팀 일정 충돌      detectTeamConflicts
 *   4) 청구 누락/과소 청구   detectBillingGaps
 * 어떤 함수도 store/DOM에 의존하지 않는다 — 배열/객체만 입출력하므로
 * 브라우저 콘솔이나 테스트 러너에서 그대로 재사용 가능하다.
 * =================================================================== */
(function (global) {
  "use strict";

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function committedScope(quote, changeOrders) {
    const quoteTotal = quote ? quote.total : 0;
    const approvedExtra = changeOrders
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    return quoteTotal + approvedExtra;
  }

  /* 1) 추가 작업 승인 누락 --------------------------------------------
   * 규칙: 자재사용/작업기록이 특정 추가작업요청(changeOrder)을 근거로
   * 발생했다면, 그 changeOrder는 "approved" 상태여야 하고, 승인 시각이
   * 실제 사용/시공 시각보다 앞서야 한다. 그렇지 않으면
   * "승인 없이(또는 승인 전에) 추가 작업이 먼저 진행됨" 으로 표시한다.
   * changeOrderId가 없는 자재사용인데 원 견적에 없는 품목을 초과 사용한
   * 경우도 별도로 잡아낸다(자재비 초과 시공). */
  function detectMissingApprovals({ jobs, changeOrders, materialUsages, quotes }) {
    const alerts = [];
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const quoteById = new Map(quotes.map((q) => [q.id, q]));

    for (const usage of materialUsages) {
      if (!usage.changeOrderId) continue; // 정규 견적 범위 내 사용은 대상 아님
      const co = changeOrders.find((c) => c.id === usage.changeOrderId);
      const job = jobById.get(usage.jobId);
      const usedAt = new Date(usage.usedAt).getTime();

      if (!co) {
        alerts.push({
          type: "missing_approval",
          severity: "critical",
          jobId: usage.jobId,
          jobTitle: job ? job.title : usage.jobId,
          message: `존재하지 않는 추가작업요청(${usage.changeOrderId})을 근거로 자재가 사용됨`,
        });
        continue;
      }

      const approvedAt = co.approvedAt ? new Date(co.approvedAt).getTime() : null;
      if (co.status !== "approved" || approvedAt === null || usedAt < approvedAt) {
        alerts.push({
          type: "missing_approval",
          severity: "critical",
          jobId: usage.jobId,
          jobTitle: job ? job.title : usage.jobId,
          changeOrderId: co.id,
          changeOrderDesc: co.description,
          message:
            co.status !== "approved"
              ? `"${co.description}" 추가 작업이 고객 승인 전(상태: ${statusKo(co.status)})에 이미 시공/자재사용됨`
              : `"${co.description}" 추가 작업이 승인 시각(${fmt(co.approvedAt)})보다 먼저(${fmt(usage.usedAt)}) 시공됨`,
        });
      }
    }

    // 견적 총액을 초과하는 자재비가 발생했는데 관련 승인 추가작업이 전혀 없는 경우
    for (const job of jobs) {
      const quote = quoteById.get(job.quoteId);
      if (!quote) continue;
      const jobChangeOrders = changeOrders.filter((c) => c.jobId === job.id);
      const scope = committedScope(quote, jobChangeOrders);
      const usagesCost = materialUsages
        .filter((u) => u.jobId === job.id)
        .reduce((sum, u) => sum + (u.cost || 0), 0);
      if (usagesCost > scope && jobChangeOrders.every((c) => c.status !== "approved")) {
        alerts.push({
          type: "missing_approval",
          severity: "warning",
          jobId: job.id,
          jobTitle: job.title,
          message: `자재 사용 금액(${won(usagesCost)})이 승인된 견적 범위(${won(scope)})를 초과했지만 승인된 추가작업요청이 없음`,
        });
      }
    }

    return alerts;
  }

  /* 2) 자재 중복 예약(초과 예약) ----------------------------------------
   * 규칙: 동일 자재에 대해 같은 날짜에 걸린 모든 예약 수량의 합이
   * 현재 재고 수량을 넘으면 "중복/초과 예약"으로 표시한다.
   * 또한 같은 작업이 같은 자재를 같은 날짜에 두 번 예약한 명백한
   * 중복 입력도 함께 잡아낸다. */
  function detectMaterialOverbooking({ materials, reservations }) {
    const alerts = [];
    const materialById = new Map(materials.map((m) => [m.id, m]));

    // 자재+날짜 별로 그룹핑
    const groups = new Map(); // key: materialId|date -> reservations[]
    for (const r of reservations) {
      const key = `${r.materialId}|${r.date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    for (const [key, list] of groups) {
      const [materialId, date] = key.split("|");
      const material = materialById.get(materialId);
      if (!material) continue;
      const totalQty = list.reduce((s, r) => s + r.qty, 0);

      if (totalQty > material.stockQty) {
        alerts.push({
          type: "material_overbooking",
          severity: "critical",
          materialId,
          materialName: material.name,
          date,
          jobs: list.map((r) => r.jobId),
          message: `"${material.name}" ${date} 예약 합계 ${totalQty}${material.unit}가 재고 ${material.stockQty}${material.unit}를 초과 (관련 작업 ${list.length}건)`,
        });
      }

      // 같은 작업이 같은 자재/날짜에 2회 이상 예약(입력 실수/중복 클릭)
      const byJob = new Map();
      for (const r of list) {
        byJob.set(r.jobId, (byJob.get(r.jobId) || 0) + 1);
      }
      for (const [jobId, count] of byJob) {
        if (count > 1) {
          alerts.push({
            type: "material_overbooking",
            severity: "warning",
            materialId,
            materialName: material.name,
            date,
            jobId,
            message: `작업(${jobId})이 "${material.name}"을(를) ${date}에 ${count}번 중복 예약함`,
          });
        }
      }
    }

    return alerts;
  }

  /* 3) 작업팀 일정 충돌 --------------------------------------------------
   * 규칙: 동일 작업팀에 배정된 두 작업의 [시작,종료) 구간이 겹치면
   * 충돌로 표시한다. 취소된 작업은 제외. */
  function detectTeamConflicts({ jobs, teams }) {
    const alerts = [];
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const active = jobs.filter((j) => j.status !== "cancelled" && j.teamId);
    const byTeam = new Map();
    for (const j of active) {
      if (!byTeam.has(j.teamId)) byTeam.set(j.teamId, []);
      byTeam.get(j.teamId).push(j);
    }

    for (const [teamId, list] of byTeam) {
      const team = teamById.get(teamId);
      list.sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const aS = new Date(a.scheduledStart).getTime();
          const aE = new Date(a.scheduledEnd).getTime();
          const bS = new Date(b.scheduledStart).getTime();
          const bE = new Date(b.scheduledEnd).getTime();
          if (overlaps(aS, aE, bS, bE)) {
            alerts.push({
              type: "team_conflict",
              severity: "critical",
              teamId,
              teamName: team ? team.name : teamId,
              jobA: { id: a.id, title: a.title, start: a.scheduledStart, end: a.scheduledEnd },
              jobB: { id: b.id, title: b.title, start: b.scheduledStart, end: b.scheduledEnd },
              message: `${team ? team.name : teamId} 팀: "${a.title}"와 "${b.title}" 일정이 겹침 (${fmt(a.scheduledStart)}~${fmt(a.scheduledEnd)} / ${fmt(b.scheduledStart)}~${fmt(b.scheduledEnd)})`,
            });
          }
        }
      }
    }
    return alerts;
  }

  /* 4) 청구 누락 / 과소 청구 --------------------------------------------
   * 규칙: 완료(completed) 상태인 작업 중 청구서(invoice)가 없으면
   * "청구 누락". 청구서는 있지만 금액이 (견적 + 승인된 추가작업)의
   * 합보다 작으면 "과소 청구"(추가 작업 청구 누락 가능성)로 표시한다. */
  function detectBillingGaps({ jobs, quotes, changeOrders, invoices }) {
    const alerts = [];
    const quoteById = new Map(quotes.map((q) => [q.id, q]));
    const completed = jobs.filter((j) => j.status === "completed");

    for (const job of completed) {
      const invoice = invoices.find((inv) => inv.jobId === job.id);
      const quote = quoteById.get(job.quoteId);
      const jobChangeOrders = changeOrders.filter((c) => c.jobId === job.id);
      const scope = committedScope(quote, jobChangeOrders);

      if (!invoice) {
        alerts.push({
          type: "billing_gap",
          severity: "critical",
          jobId: job.id,
          jobTitle: job.title,
          expected: scope,
          message: `"${job.title}" 작업이 완료되었지만 청구서가 발행되지 않음 (예상 청구액 ${won(scope)})`,
        });
        continue;
      }

      if (invoice.amount < scope) {
        alerts.push({
          type: "billing_gap",
          severity: "warning",
          jobId: job.id,
          jobTitle: job.title,
          expected: scope,
          billed: invoice.amount,
          message: `"${job.title}" 청구액(${won(invoice.amount)})이 승인된 범위(${won(scope)})보다 적음 — 추가 작업분 청구 누락 의심`,
        });
      }
    }
    return alerts;
  }

  function runAllDetectors(data) {
    return [
      ...detectMissingApprovals(data),
      ...detectMaterialOverbooking(data),
      ...detectTeamConflicts(data),
      ...detectBillingGaps(data),
    ];
  }

  function statusKo(s) {
    return (
      { pending: "승인대기", approved: "승인완료", rejected: "반려" }[s] || s
    );
  }
  function won(n) {
    return (n || 0).toLocaleString("ko-KR") + "원";
  }
  function fmt(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  const Detectors = {
    detectMissingApprovals,
    detectMaterialOverbooking,
    detectTeamConflicts,
    detectBillingGaps,
    runAllDetectors,
    committedScope,
    won,
    fmt,
  };

  global.Detectors = Detectors;
  if (typeof module !== "undefined" && module.exports) module.exports = Detectors;
})(typeof window !== "undefined" ? window : globalThis);
