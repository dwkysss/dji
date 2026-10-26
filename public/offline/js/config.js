/**
 * Configuration, Constants, and Utility Helpers
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const STORAGE_KEYS = {
    BOOTSTRAP: "dji_mobile_bootstrap",
    HEADER: "dji_form_header",
    QUEUE: "dji_offline_queue",
    USER: "dji_cached_user",
    DOWNTIME: "dji_downtime_events"
  };

  /**
   * Aturan Perhitungan Hari Operasional Kerja (Cut-off Bukan Jam 12 Malam)
   * - Pergantian hari operasional kerja pabrik TIDAK berganti pada jam 12:00 malam (00:00 WIB),
   *   melainkan berganti pada pukul 07:10 WIB pagi (siklus 07:10 WIB hingga 07:10 WIB hari berikutnya).
   * - Shift 1: 07:10 - 15:10 WIB
   * - Shift 2: 15:10 - 23:10 WIB
   * - Shift 3: 23:10 - 07:10 WIB (melewati tengah malam)
   * - Transaksi pukul 00:00:00 - 07:09:59 WIB diatribusikan ke tanggal operasional hari sebelumnya.
   */
  function getOperationalDate(d = new Date()) {
    // Offset to WIB (UTC+7)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));

    const hours = wib.getHours();
    const minutes = wib.getMinutes();

    // If before 07:10 WIB, rollback 1 day
    if (hours < 7 || (hours === 7 && minutes < 10)) {
      wib.setDate(wib.getDate() - 1);
    }

    const yyyy = wib.getFullYear();
    const mm = String(wib.getMonth() + 1).padStart(2, "0");
    const dd = String(wib.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function getOperationalShift(d = new Date()) {
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));

    const totalMinutes = wib.getHours() * 60 + wib.getMinutes();
    const shift1Start = 7 * 60 + 10;   // 07:10 = 430 min
    const shift2Start = 15 * 60 + 10;  // 15:10 = 910 min
    const shift3Start = 23 * 60 + 10;  // 23:10 = 1390 min

    if (totalMinutes >= shift1Start && totalMinutes < shift2Start) {
      return { shiftNumber: "1", shiftGroup: "A" };
    } else if (totalMinutes >= shift2Start && totalMinutes < shift3Start) {
      return { shiftNumber: "2", shiftGroup: "B" };
    } else {
      return { shiftNumber: "3", shiftGroup: "C" };
    }
  }

  function normalizeGroupLetter(g) {
    if (!g) return "A";
    const s = String(g).toUpperCase().trim();
    if (s.includes("A") || s === "1") return "A";
    if (s.includes("B") || s === "2") return "B";
    if (s.includes("C") || s === "3") return "C";
    return "A";
  }

  function formatDuration(sec) {
    const safeSec = Math.max(0, parseInt(sec, 10) || 0);
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function showToast(msg) {
    const box = document.getElementById("toastBox");
    if (!box) return;
    box.textContent = msg;
    box.classList.add("show");
    setTimeout(() => {
      box.classList.remove("show");
    }, 3000);
  }

  const PROBLEM_CATEGORIES = [
    { id: "A", name: "Kode A: Masalah dan Perbaikan Benang", short: "Benang" },
    { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)", short: "Jarum & Mekanik" },
    { id: "C", name: "Kode C: Pengaturan dan Design setup", short: "Design & Setup" },
    { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang", short: "Bahan Baku" },
    { id: "E", name: "Kode E: Masalah Kelistrikan", short: "Kelistrikan" },
    { id: "F", name: "Kode F: Perawatan Mesin, Perbaikan Mekanik (Maintenance)", short: "Maintenance" },
    { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis", short: "Eksternal & Non-Teknis" }
  ];

  const GROUPED_PROBLEM_DETAILS = {
    A: [
      {
        groupName: "Benang Dasar",
        items: ["L1 Putus", "Keluar Jarum L2/L3", "L2/L3 Putus"]
      },
      {
        groupName: "Benang Timbul",
        items: ["Benang Narik/Kendor", "Benang Timbul Putus", "Keluar Jarum Timbul"]
      },
      {
        groupName: "Lain-lain / Tambahan",
        items: [
          "Bolong Corak", "Perbaikan Jalur Benang", "Bolong Dasar", "Perbaikan Meped",
          "Perbaikan Bolong-bolong", "Floating Keanyam", "Benang Nyilang",
          "Benang Kejepit/Jebol/Kusut", "Perbaikan/Beset Benang Dasar", "Benang Lolos", "Perb/Ganti Tricplet"
        ]
      }
    ],
    B: [
      {
        groupName: "Jarum & Jacquard",
        items: ["Jarum pattern patah/bengkok", "Ganti Jacquard", "Ganti jarum Compoun Nedle, pattern", "Ngampul", "Keluar Jarum"]
      },
      {
        groupName: "Mekanisme & Komponen",
        items: ["Ganti dari scaloop ke non scaloop atau sebaliknya", "Ngegaris/Stopline", "Ganti String bar", "Ganti PBO", "Pressan As beam kendor", "Tensi tensioner"]
      }
    ],
    C: [
      {
        groupName: "Ganti & Revisi Design",
        items: ["Loading design/Ganti Design", "Perbaikan corak/revisi", "Salah ganti design", "Error design"]
      },
      {
        groupName: "Setting & Hardware",
        items: ["Proofing/PCB", "Ganti Pattern Disk", "Ganti pick"]
      }
    ],
    D: [
      {
        groupName: "Benang Dasar (L1/L2)",
        items: ["Ganti benang dasar L1/L2", "Salah ganti benang dasar", "Tunggu benang dasar dari warping"]
      },
      {
        groupName: "Benang Pattern (L/H/S)",
        items: ["Ganti benang Pattern Linner", "Ganti benang Pattern Heavy", "Ganti benang Pattern Shadow", "Ganti benang pattern keseluruhan (L,H,S)", "salah ganti benang pattern"]
      },
      {
        groupName: "Suplai & Persiapan Benang",
        items: ["Ngelancarin", "Over Cone/Rewind", "Tunggu benang (benang belum datang)"]
      }
    ],
    E: [
      {
        groupName: "Motor & Driver",
        items: ["Error Servo Drive", "Ganti motor servo"]
      },
      {
        groupName: "Sensor & Kelistrikan",
        items: ["Sensor Benang/Laser Stop", "Perbaikan Eletrik lainnya", "Konsleting", "Perbaikan listrik"]
      }
    ],
    F: [
      {
        groupName: "Pneumatik & Mekanik",
        items: ["Perbaikan cilynder Angin", "Ganti Bellow", "Perbaikan gear/Take Up Roll", "Ganti rantai/pertensi", "Ganti Black grip roll", "Ganti Vanbelt"]
      },
      {
        groupName: "Maintenance & Servis",
        items: ["Ganti Oli", "Pelumasan/greace pada mesin", "Perawatan Panel Listrik", "Servis Overhaul"]
      }
    ],
    G: [
      {
        groupName: "Operasional & Pabrik",
        items: [
          "Hari Libur",
          "Tidak ada order",
          "Tunggu info",
          "Demo",
          "Bencana/gempa/banjir",
          "Istirahat selama buka puasa",
          "Mati Listrik"
        ]
      },
      {
        groupName: "Material & Logistik",
        items: ["Tunggu Sparepart"]
      }
    ]
  };

  const FALLBACK_OPERATORS = [
    { id: "1", name: "Rohmat", shift: "A" },
    { id: "2", name: "M.Alwi", shift: "A" },
    { id: "3", name: "Anwar", shift: "A" },
    { id: "4", name: "Jaya", shift: "A" },
    { id: "5", name: "Riki S", shift: "A" },
    { id: "6", name: "Sandi M", shift: "A" },
    { id: "7", name: "Padlan", shift: "A" },
    { id: "8", name: "Rissa A", shift: "A" },
    { id: "9", name: "Devi K", shift: "A" },
    { id: "10", name: "Novi S", shift: "A" },
    { id: "11", name: "Udin", shift: "A" },
    { id: "12", name: "Irfan", shift: "B" },
    { id: "13", name: "Anton", shift: "B" },
    { id: "14", name: "Ahmad S", shift: "B" },
    { id: "15", name: "Saepudin", shift: "B" },
    { id: "16", name: "Parid", shift: "B" },
    { id: "17", name: "Noval", shift: "B" },
    { id: "18", name: "Sigit", shift: "B" },
    { id: "19", name: "Rani Y", shift: "B" },
    { id: "20", name: "Yanti P", shift: "B" },
    { id: "21", name: "Irma P", shift: "B" },
    { id: "22", name: "Aris W", shift: "B" },
    { id: "23", name: "Tubagus", shift: "C" },
    { id: "24", name: "Andri Y", shift: "C" },
    { id: "25", name: "Royana", shift: "C" },
    { id: "26", name: "Komara", shift: "C" },
    { id: "27", name: "Sopian", shift: "C" },
    { id: "28", name: "Iki S", shift: "C" },
    { id: "29", name: "Hardi", shift: "C" },
    { id: "30", name: "Rini D", shift: "C" },
    { id: "31", name: "Neneng", shift: "C" },
    { id: "32", name: "Rina R", shift: "C" },
    { id: "33", name: "Farhan", shift: "C" }
  ];

  function resolveOperatorId(name, bootstrap) {
    if (bootstrap && Array.isArray(bootstrap.operators)) {
      const found = bootstrap.operators.find(o => (o.name || o.nama_operator) === name);
      if (found && found.id) return String(found.id);
    }
    const fb = FALLBACK_OPERATORS.find(o => o.name === name);
    return fb ? String(fb.id) : "1";
  }

  const IDB_CONFIG = {
    DB_NAME: "dji_offline_db",
    STORE_NAME: "pending_queue",
    VERSION: 1
  };

  function openOfflineIDB() {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        return reject("IndexedDB tidak didukung");
      }
      const req = window.indexedDB.open(IDB_CONFIG.DB_NAME, IDB_CONFIG.VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
          db.createObjectStore(IDB_CONFIG.STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function savePendingToIDB(payload) {
    try {
      const db = await openOfflineIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.put(payload);
        req.onsuccess = () => {
          window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IndexedDB save fallback to localStorage only:", e);
    }
  }

  async function removePendingFromIDB(id) {
    try {
      const db = await openOfflineIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => {
          window.dispatchEvent(new CustomEvent("dji_offline_queue_changed"));
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IndexedDB delete fallback:", e);
    }
  }

  window.DJIConfig = {
    KEYS: STORAGE_KEYS,
    PROBLEM_CATEGORIES,
    GROUPED_PROBLEM_DETAILS,
    FALLBACK_OPERATORS,
    resolveOperatorId,
    savePendingToIDB,
    removePendingFromIDB,
    getOperationalDate,
    getOperationalShift,
    normalizeGroupLetter,
    formatDuration,
    showToast
  };
})(window);

