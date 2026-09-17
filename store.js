/* ===================================================================
 * store.js — 데이터 저장 계층.
 * claude.use("db") 가 가능하면(실제로 게시된 아티팩트를 조직 내 사용자가
 * 열었을 때) 그 문서 저장소를 그대로 쓰고, 불가능하면(미리보기, 외부
 * 브라우저 등) localStorage 폴백으로 동일한 인터페이스를 제공한다.
 * 두 경우 모두 위에서 보는 화면과 동작은 완전히 동일하다.
 * =================================================================== */
(function (global) {
  "use strict";

  const COLLECTIONS = [
    "customers",
    "inquiries",
    "siteVisits",
    "quotes",
    "changeOrders",
    "teams",
    "jobs",
    "materials",
    "materialReservations",
    "materialUsages",
    "invoices",
  ];

  const LS_KEY = "tteuntteun_seolbi_v1";

  function uid() {
    return (
      Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9)
    );
  }

  function seedData() {
    const c1 = "cust_1", c2 = "cust_2", c3 = "cust_3", c4 = "cust_4", c5 = "cust_5";
    const t1 = "team_1", t2 = "team_2";
    const m1 = "mat_1", m2 = "mat_2", m3 = "mat_3", m4 = "mat_4", m5 = "mat_5", m6 = "mat_6";

    const customers = [
      { id: c1, name: "박서연", phone: "010-2231-5567", address: "서울 마포구 성산동 12-3", memo: "다세대주택 3층", createdAt: "2026-09-01T09:10:00" },
      { id: c2, name: "김도현", phone: "010-8842-1190", address: "서울 마포구 연남동 45-1", memo: "", createdAt: "2026-09-02T10:00:00" },
      { id: c3, name: "장수민 (수민이네 분식)", phone: "010-3321-7789", address: "서울 마포구 망원동 88 1층", memo: "영업시간 10-21시, 영업 전 방문 요망", createdAt: "2026-09-03T14:20:00" },
      { id: c4, name: "이하은", phone: "010-6612-4432", address: "서울 마포구 합정동 21-7", memo: "", createdAt: "2026-09-05T11:00:00" },
      { id: c5, name: "최우진 (우진빌딩 관리소)", phone: "010-9987-2201", address: "서울 마포구 서교동 101", memo: "건물 관리소, 세금계산서 발행 필요", createdAt: "2026-09-08T09:30:00" },
    ];

    const teams = [
      { id: t1, name: "1팀 (김반장)", members: "김반장, 오기사" },
      { id: t2, name: "2팀 (이반장)", members: "이반장, 문기사" },
    ];

    const materials = [
      { id: m1, name: "PVC 파이프 100A", unit: "개", stockQty: 10, unitCost: 8000 },
      { id: m2, name: "동관 15A (10m)", unit: "롤", stockQty: 6, unitCost: 45000 },
      { id: m3, name: "수전 (싱크대용)", unit: "개", stockQty: 8, unitCost: 32000 },
      { id: m4, name: "가정용 순간온수기", unit: "대", stockQty: 3, unitCost: 210000 },
      { id: m5, name: "볼밸브 25A", unit: "개", stockQty: 15, unitCost: 6000 },
      { id: m6, name: "배관 단열재", unit: "m", stockQty: 40, unitCost: 2500 },
    ];

    const inquiries = [
      { id: "inq_1", customerId: c1, customerName: customers[0].name, phone: customers[0].phone, address: customers[0].address, description: "화장실 세면대 하부 누수, 바닥이 계속 젖어있음", channel: "전화", status: "quoted", createdAt: "2026-09-10T09:00:00" },
      { id: "inq_2", customerId: c2, customerName: customers[1].name, phone: customers[1].phone, address: customers[1].address, description: "주방 싱크대 수전 교체 희망, 물이 새서 교체 필요", channel: "온라인", status: "quoted", createdAt: "2026-09-11T13:20:00" },
      { id: "inq_3", customerId: c3, customerName: customers[2].name, phone: customers[2].phone, address: customers[2].address, description: "주방 배관 노후로 전체 교체 문의, 영업 전 오전 방문", channel: "방문", status: "quoted", createdAt: "2026-09-12T08:40:00" },
      { id: "inq_4", customerId: c4, customerName: customers[3].name, phone: customers[3].phone, address: customers[3].address, description: "보일러 온수 안 나옴, 순간온수기 점검/교체 요청", channel: "전화", status: "site_visit_scheduled", createdAt: "2026-09-15T10:15:00" },
      { id: "inq_5", customerId: c5, customerName: customers[4].name, phone: customers[4].phone, address: customers[4].address, description: "건물 옥상 배관 동파 대비 단열 보강 문의", channel: "전화", status: "new", createdAt: "2026-09-16T16:00:00" },
    ];

    const siteVisits = [
      { id: "sv_1", inquiryId: "inq_1", scheduledAt: "2026-09-10T15:00:00", memo: "P트랩 파손 확인, 실리콘 마감 열화", status: "done", doneAt: "2026-09-10T15:30:00" },
      { id: "sv_2", inquiryId: "inq_2", scheduledAt: "2026-09-11T16:00:00", memo: "수전 본체 균열, 밸브 동시 교체 권장", status: "done", doneAt: "2026-09-11T16:30:00" },
      { id: "sv_3", inquiryId: "inq_3", scheduledAt: "2026-09-12T09:00:00", memo: "주방 배관 전 구간 부식 심각, 전체 교체 필요", status: "done", doneAt: "2026-09-12T09:40:00" },
      { id: "sv_4", inquiryId: "inq_4", scheduledAt: "2026-09-19T10:00:00", memo: "", status: "scheduled" },
    ];

    const quotes = [
      {
        id: "quo_1", inquiryId: "inq_1", customerId: c1, customerName: customers[0].name,
        items: [
          { desc: "P트랩 교체", qty: 1, unitPrice: 25000 },
          { desc: "실리콘 재시공", qty: 1, unitPrice: 15000 },
          { desc: "출장비", qty: 1, unitPrice: 20000 },
        ],
        total: 60000, status: "approved", createdAt: "2026-09-10T17:00:00", sentAt: "2026-09-10T17:05:00", approvedAt: "2026-09-10T19:20:00", approvedBy: "박서연(고객)",
      },
      {
        id: "quo_2", inquiryId: "inq_2", customerId: c2, customerName: customers[1].name,
        items: [
          { desc: "싱크대 수전 교체", qty: 1, unitPrice: 65000 },
          { desc: "출장비", qty: 1, unitPrice: 20000 },
        ],
        total: 85000, status: "approved", createdAt: "2026-09-11T18:00:00", sentAt: "2026-09-11T18:05:00", approvedAt: "2026-09-11T20:00:00", approvedBy: "김도현(고객)",
      },
      {
        id: "quo_3", inquiryId: "inq_3", customerId: c3, customerName: customers[2].name,
        items: [
          { desc: "주방 배관 전체 교체 (PVC 100A)", qty: 6, unitPrice: 8000 },
          { desc: "동관 15A 배관 연결", qty: 2, unitPrice: 45000 },
          { desc: "인건비 (2인 1일)", qty: 1, unitPrice: 260000 },
        ],
        total: 398000, status: "approved", createdAt: "2026-09-12T11:00:00", sentAt: "2026-09-12T11:10:00", approvedAt: "2026-09-12T15:00:00", approvedBy: "장수민(고객)",
      },
    ];

    const changeOrders = [
      // 정상: 승인 후 시공 (job_1)
      { id: "co_1", jobId: "job_1", quoteId: "quo_1", description: "천장 배관 보온재 추가 시공", amount: 12000, status: "approved", createdAt: "2026-09-13T09:00:00", approvedAt: "2026-09-13T09:40:00", approvedBy: "박서연(고객, 문자 승인)" },
      // 문제: 승인 대기 상태인데 이미 자재가 투입됨 (job_2)
      { id: "co_2", jobId: "job_2", quoteId: "quo_2", description: "노후 급수 밸브 추가 교체", amount: 18000, status: "pending", createdAt: "2026-09-14T13:00:00", approvedAt: null },
      // 진행중: 아직 시공 전 (job_3)
      { id: "co_3", jobId: "job_3", quoteId: "quo_3", description: "배관 단열재 전 구간 추가", amount: 65000, status: "approved", createdAt: "2026-09-13T10:00:00", approvedAt: "2026-09-13T18:00:00", approvedBy: "장수민(고객)" },
    ];

    const jobs = [
      {
        id: "job_1", quoteId: "quo_1", inquiryId: "inq_1", customerId: c1, customerName: customers[0].name,
        title: "박서연 세면대 누수 수리", teamId: t1,
        scheduledStart: "2026-09-13T09:00:00", scheduledEnd: "2026-09-13T11:00:00",
        status: "completed", createdAt: "2026-09-10T19:25:00", completedAt: "2026-09-13T11:00:00",
      },
      {
        id: "job_2", quoteId: "quo_2", inquiryId: "inq_2", customerId: c2, customerName: customers[1].name,
        title: "김도현 싱크대 수전 교체", teamId: t2,
        // 아래 job_4와 동일 팀(2팀) 일정이 겹치도록 의도적으로 배치 → 일정 충돌 데모
        scheduledStart: "2026-09-14T13:00:00", scheduledEnd: "2026-09-14T15:00:00",
        status: "completed", createdAt: "2026-09-11T20:05:00", completedAt: "2026-09-14T15:10:00",
      },
      {
        id: "job_3", quoteId: "quo_3", inquiryId: "inq_3", customerId: c3, customerName: customers[2].name,
        title: "수민이네 분식 주방 배관 전체교체", teamId: t1,
        scheduledStart: "2026-09-18T07:00:00", scheduledEnd: "2026-09-18T16:00:00",
        status: "in_progress", createdAt: "2026-09-12T15:05:00",
      },
      {
        id: "job_4", quoteId: "quo_2", inquiryId: "inq_2", customerId: c2, customerName: customers[1].name,
        title: "김도현 추가 밸브 점검", teamId: t2,
        scheduledStart: "2026-09-14T14:00:00", scheduledEnd: "2026-09-14T16:00:00",
        status: "scheduled", createdAt: "2026-09-14T13:05:00",
      },
    ];

    const materialReservations = [
      { id: "res_1", jobId: "job_1", materialId: m6, qty: 4, date: "2026-09-13", createdAt: "2026-09-13T08:30:00" },
      { id: "res_2", jobId: "job_2", materialId: m3, qty: 1, date: "2026-09-14", createdAt: "2026-09-11T20:10:00" },
      // 자재 초과예약 데모: 동관 15A 재고 6롤인데 같은 날 두 현장이 각각 4롤씩 예약(합계 8 > 6)
      { id: "res_3", jobId: "job_3", materialId: m2, qty: 4, date: "2026-09-18", createdAt: "2026-09-12T15:10:00" },
      { id: "res_4", jobId: "job_4", materialId: m2, qty: 4, date: "2026-09-18", createdAt: "2026-09-16T09:00:00" },
      // 중복 입력 데모: 같은 작업이 같은 자재를 같은 날 2번 예약
      { id: "res_5", jobId: "job_3", materialId: m1, qty: 6, date: "2026-09-18", createdAt: "2026-09-12T15:12:00" },
      { id: "res_6", jobId: "job_3", materialId: m1, qty: 6, date: "2026-09-18", createdAt: "2026-09-17T08:00:00" },
    ];

    const materialUsages = [
      { id: "use_1", jobId: "job_1", materialId: m6, qty: 4, cost: 10000, usedAt: "2026-09-13T10:30:00", changeOrderId: "co_1", note: "천장 배관 보온재 시공" },
      // 문제 데모: 승인 대기(co_2)인 추가작업 자재가 이미 사용됨
      { id: "use_2", jobId: "job_2", materialId: m5, qty: 1, cost: 6000, usedAt: "2026-09-14T13:30:00", changeOrderId: "co_2", note: "밸브 선(先) 교체 후 승인 요청 예정" },
      { id: "use_3", jobId: "job_2", materialId: m3, qty: 1, cost: 32000, usedAt: "2026-09-14T14:10:00", changeOrderId: null, note: "견적 범위 내 수전 교체" },
    ];

    const invoices = [
      { id: "inv_1", jobId: "job_1", quoteId: "quo_1", amount: 72000, issuedAt: "2026-09-13T11:30:00", dueDate: "2026-09-20", status: "paid", paidAt: "2026-09-13T18:00:00" },
      // 문제 데모: job_2 완료됐지만 청구서가 없음 (청구 누락)
      // -> invoices 배열에 job_2 항목을 의도적으로 넣지 않음
    ];

    return {
      customers, inquiries, siteVisits, quotes, changeOrders, teams,
      jobs, materials, materialReservations, materialUsages, invoices,
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* localStorage 접근 불가 시 무시하고 시드로 진행 */
    }
    const seeded = seedData();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    } catch (e) {}
    return seeded;
  }

  function saveLocal(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function Store() {
    this.mode = "local"; // "db" | "local"
    this.db = null;
    this.state = {};
    for (const c of COLLECTIONS) this.state[c] = [];
    this.listeners = [];
  }

  Store.prototype.onChange = function (fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  };

  Store.prototype.emit = function () {
    for (const fn of this.listeners) {
      try {
        fn(this.state, this.mode);
      } catch (e) {
        console.error(e);
      }
    }
  };

  Store.prototype.init = async function () {
    let db = null;
    try {
      if (global.claude && typeof global.claude.use === "function") {
        db = await global.claude.use("db");
      }
    } catch (e) {
      db = null;
    }

    if (db) {
      this.mode = "db";
      this.db = db;
      // 최초 진입 시 비어있으면 시드 데이터 기록
      const first = await db.collection("customers").limit(1).get();
      if (first.empty) {
        const seeded = seedData();
        for (const c of COLLECTIONS) {
          for (const doc of seeded[c]) {
            const { id, ...rest } = doc;
            await db.doc(`${c}/${id}`).set(rest);
          }
        }
      }
      for (const c of COLLECTIONS) {
        db.collection(c).onSnapshot(
          (snap) => {
            this.state[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            this.emit();
          },
          () => {
            /* 구독 오류 시에도 화면은 마지막 상태로 유지 */
          }
        );
      }
    } else {
      this.mode = "local";
      this.state = loadLocal();
      this.emit();
    }
  };

  Store.prototype._persistLocal = function () {
    saveLocal(this.state);
    this.emit();
  };

  Store.prototype.add = async function (collection, data) {
    const id = uid();
    if (this.mode === "db") {
      await this.db.doc(`${collection}/${id}`).set(data);
    } else {
      this.state[collection].push({ id, ...data });
      this._persistLocal();
    }
    return id;
  };

  Store.prototype.update = async function (collection, id, patch) {
    if (this.mode === "db") {
      await this.db.doc(`${collection}/${id}`).update(patch);
    } else {
      const list = this.state[collection];
      const idx = list.findIndex((d) => d.id === id);
      if (idx >= 0) list[idx] = { ...list[idx], ...patch };
      this._persistLocal();
    }
  };

  Store.prototype.remove = async function (collection, id) {
    if (this.mode === "db") {
      await this.db.doc(`${collection}/${id}`).delete();
    } else {
      this.state[collection] = this.state[collection].filter((d) => d.id !== id);
      this._persistLocal();
    }
  };

  Store.prototype.list = function (collection) {
    return this.state[collection] || [];
  };

  Store.prototype.get = function (collection, id) {
    return (this.state[collection] || []).find((d) => d.id === id) || null;
  };

  global.Store = new Store();
  global.COLLECTIONS = COLLECTIONS;
})(typeof window !== "undefined" ? window : globalThis);
