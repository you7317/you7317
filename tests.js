/* ===================================================================
 * tests.js — detectors.js에 대한 자체 실행 테스트 스위트.
 * Node/외부 테스트 러너 없이도 앱 안(#/tests 화면)에서 즉시 실행/표시된다.
 * 각 탐지기마다 "적발해야 하는 경우"(양성)와 "정상 처리라 넘어가야
 * 하는 경우"(음성, 오탐 방지 확인)를 함께 검증한다.
 * =================================================================== */
(function (global) {
  "use strict";
  const D = global.Detectors;
  const results = [];
  let currentSuite = "";

  function suite(name, fn) {
    currentSuite = name;
    fn();
  }

  function test(name, fn) {
    try {
      fn();
      results.push({ suite: currentSuite, name, pass: true });
    } catch (e) {
      results.push({ suite: currentSuite, name, pass: false, error: e.message });
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
  }
  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(`${msg || "값 불일치"} (기대: ${b}, 실제: ${a})`);
  }
  function assertCount(arr, n, msg) {
    if (arr.length !== n) {
      throw new Error(
        `${msg || "건수 불일치"} (기대: ${n}건, 실제: ${arr.length}건) — ${JSON.stringify(arr.map((a) => a.message))}`
      );
    }
  }

  /* ---------- 1) 추가 작업 승인 누락 ---------- */
  suite("추가 작업 승인 누락 탐지", () => {
    test("승인 전(pending) 추가작업에 대한 자재사용 → 적발되어야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "누수 수리", quoteId: "Q1", status: "in_progress" }],
        quotes: [{ id: "Q1", total: 100000 }],
        changeOrders: [
          { id: "C1", jobId: "J1", description: "배관 추가 교체", amount: 50000, status: "pending", approvedAt: null },
        ],
        materialUsages: [
          { jobId: "J1", materialId: "M1", qty: 2, cost: 20000, usedAt: "2026-09-10T09:00:00", changeOrderId: "C1" },
        ],
      };
      const alerts = D.detectMissingApprovals(data);
      assertCount(alerts, 1, "미승인 상태의 추가작업 사용은 1건 적발되어야 함");
      assertEqual(alerts[0].severity, "critical");
    });

    test("승인 시각보다 먼저 시공된 추가작업 → 적발되어야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "보일러 교체", quoteId: "Q1", status: "in_progress" }],
        quotes: [{ id: "Q1", total: 300000 }],
        changeOrders: [
          {
            id: "C1",
            jobId: "J1",
            description: "배관 단열재 추가",
            amount: 30000,
            status: "approved",
            approvedAt: "2026-09-10T14:00:00",
          },
        ],
        materialUsages: [
          { jobId: "J1", materialId: "M2", qty: 1, cost: 15000, usedAt: "2026-09-10T09:00:00", changeOrderId: "C1" },
        ],
      };
      const alerts = D.detectMissingApprovals(data);
      assertCount(alerts, 1, "승인 이전에 사용 기록이 있으면 적발되어야 함");
    });

    test("정상: 승인 이후 시공된 추가작업 → 적발되지 않아야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "세면대 교체", quoteId: "Q1", status: "completed" }],
        quotes: [{ id: "Q1", total: 200000 }],
        changeOrders: [
          {
            id: "C1",
            jobId: "J1",
            description: "수전 추가 교체",
            amount: 40000,
            status: "approved",
            approvedAt: "2026-09-10T09:00:00",
          },
        ],
        materialUsages: [
          { jobId: "J1", materialId: "M3", qty: 1, cost: 40000, usedAt: "2026-09-10T14:00:00", changeOrderId: "C1" },
        ],
      };
      const alerts = D.detectMissingApprovals(data);
      assertCount(alerts, 0, "정상 승인 순서에서는 오탐이 없어야 함");
    });

    test("승인된 추가작업 없이 견적 범위 초과 사용 → 적발되어야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "옥상 배관 공사", quoteId: "Q1", status: "in_progress" }],
        quotes: [{ id: "Q1", total: 100000 }],
        changeOrders: [],
        materialUsages: [{ jobId: "J1", materialId: "M4", qty: 5, cost: 150000, usedAt: "2026-09-10T09:00:00", changeOrderId: null }],
      };
      const alerts = D.detectMissingApprovals(data);
      assertCount(alerts, 1, "견적 초과 사용인데 승인 근거가 없으면 적발되어야 함");
      assertEqual(alerts[0].severity, "warning");
    });
  });

  /* ---------- 2) 자재 중복 예약 ---------- */
  suite("자재 중복 예약(초과) 탐지", () => {
    test("동일 날짜 합계가 재고 초과 → 적발되어야 함", () => {
      const data = {
        materials: [{ id: "M1", name: "PVC 파이프 100A", unit: "개", stockQty: 10 }],
        reservations: [
          { jobId: "J1", materialId: "M1", qty: 6, date: "2026-09-20" },
          { jobId: "J2", materialId: "M1", qty: 7, date: "2026-09-20" },
        ],
      };
      const alerts = D.detectMaterialOverbooking(data);
      const critical = alerts.filter((a) => a.severity === "critical");
      assertCount(critical, 1, "재고 초과(6+7=13 > 10)는 1건 적발되어야 함");
    });

    test("정상: 합계가 재고 이내 → 적발되지 않아야 함", () => {
      const data = {
        materials: [{ id: "M1", name: "동관 15A", unit: "m", stockQty: 20 }],
        reservations: [
          { jobId: "J1", materialId: "M1", qty: 5, date: "2026-09-21" },
          { jobId: "J2", materialId: "M1", qty: 5, date: "2026-09-21" },
        ],
      };
      const alerts = D.detectMaterialOverbooking(data);
      assertCount(alerts, 0, "재고 이내 예약은 오탐이 없어야 함");
    });

    test("같은 작업의 동일 자재 중복 입력 → 적발되어야 함", () => {
      const data = {
        materials: [{ id: "M1", name: "밸브 25A", unit: "개", stockQty: 50 }],
        reservations: [
          { jobId: "J1", materialId: "M1", qty: 2, date: "2026-09-22" },
          { jobId: "J1", materialId: "M1", qty: 2, date: "2026-09-22" },
        ],
      };
      const alerts = D.detectMaterialOverbooking(data);
      const dup = alerts.filter((a) => a.message.includes("중복 예약함"));
      assertCount(dup, 1, "같은 작업의 중복 입력이 적발되어야 함");
    });
  });

  /* ---------- 3) 작업팀 일정 충돌 ---------- */
  suite("작업팀 일정 충돌 탐지", () => {
    test("동일 팀, 시간 겹침 → 적발되어야 함", () => {
      const data = {
        teams: [{ id: "T1", name: "1팀" }],
        jobs: [
          { id: "J1", title: "A현장", teamId: "T1", scheduledStart: "2026-09-20T09:00", scheduledEnd: "2026-09-20T12:00", status: "scheduled" },
          { id: "J2", title: "B현장", teamId: "T1", scheduledStart: "2026-09-20T11:00", scheduledEnd: "2026-09-20T14:00", status: "scheduled" },
        ],
      };
      const alerts = D.detectTeamConflicts(data);
      assertCount(alerts, 1, "겹치는 일정은 1건 적발되어야 함");
    });

    test("정상: 동일 팀, 시간 순차(겹치지 않음) → 적발되지 않아야 함", () => {
      const data = {
        teams: [{ id: "T1", name: "1팀" }],
        jobs: [
          { id: "J1", title: "A현장", teamId: "T1", scheduledStart: "2026-09-20T09:00", scheduledEnd: "2026-09-20T11:00", status: "scheduled" },
          { id: "J2", title: "B현장", teamId: "T1", scheduledStart: "2026-09-20T11:00", scheduledEnd: "2026-09-20T13:00", status: "scheduled" },
        ],
      };
      const alerts = D.detectTeamConflicts(data);
      assertCount(alerts, 0, "연속 일정은 충돌로 보지 않아야 함");
    });

    test("정상: 시간은 겹치지만 팀이 다름 → 적발되지 않아야 함", () => {
      const data = {
        teams: [{ id: "T1", name: "1팀" }, { id: "T2", name: "2팀" }],
        jobs: [
          { id: "J1", title: "A현장", teamId: "T1", scheduledStart: "2026-09-20T09:00", scheduledEnd: "2026-09-20T12:00", status: "scheduled" },
          { id: "J2", title: "B현장", teamId: "T2", scheduledStart: "2026-09-20T09:00", scheduledEnd: "2026-09-20T12:00", status: "scheduled" },
        ],
      };
      const alerts = D.detectTeamConflicts(data);
      assertCount(alerts, 0, "다른 팀끼리는 충돌이 아니어야 함");
    });
  });

  /* ---------- 4) 청구 누락 / 과소 청구 ---------- */
  suite("청구 누락·과소 청구 탐지", () => {
    test("완료된 작업에 청구서 없음 → 적발되어야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "화장실 누수 수리", quoteId: "Q1", status: "completed" }],
        quotes: [{ id: "Q1", total: 150000 }],
        changeOrders: [],
        invoices: [],
      };
      const alerts = D.detectBillingGaps(data);
      assertCount(alerts, 1, "청구서 없는 완료 건은 적발되어야 함");
      assertEqual(alerts[0].severity, "critical");
    });

    test("승인된 추가작업 포함 금액보다 적게 청구 → 적발되어야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "주방 배관 교체", quoteId: "Q1", status: "completed" }],
        quotes: [{ id: "Q1", total: 200000 }],
        changeOrders: [{ id: "C1", jobId: "J1", amount: 50000, status: "approved" }],
        invoices: [{ jobId: "J1", amount: 200000 }],
      };
      const alerts = D.detectBillingGaps(data);
      assertCount(alerts, 1, "추가작업 5만원이 청구 누락되어 과소청구로 적발되어야 함");
      assertEqual(alerts[0].severity, "warning");
    });

    test("정상: 견적+승인추가작업 전액 청구 → 적발되지 않아야 함", () => {
      const data = {
        jobs: [{ id: "J1", title: "정상 정산 건", quoteId: "Q1", status: "completed" }],
        quotes: [{ id: "Q1", total: 200000 }],
        changeOrders: [{ id: "C1", jobId: "J1", amount: 50000, status: "approved" }],
        invoices: [{ jobId: "J1", amount: 250000 }],
      };
      const alerts = D.detectBillingGaps(data);
      assertCount(alerts, 0, "정상 청구는 오탐이 없어야 함");
    });

    test("정상: 아직 완료되지 않은 작업은 청구 대상이 아님", () => {
      const data = {
        jobs: [{ id: "J1", title: "진행중 작업", quoteId: "Q1", status: "in_progress" }],
        quotes: [{ id: "Q1", total: 100000 }],
        changeOrders: [],
        invoices: [],
      };
      const alerts = D.detectBillingGaps(data);
      assertCount(alerts, 0, "미완료 작업은 청구 누락 대상이 아니어야 함");
    });
  });

  global.TestResults = results;
  global.TestSummary = {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
})(typeof window !== "undefined" ? window : globalThis);
