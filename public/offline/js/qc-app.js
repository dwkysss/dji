/**
 * DJI Portal Produksi - Offline QC Inspection Engine
 * (public/offline/js/qc-app.js)
 * Adheres strictly to factory workplace rules:
 * - 07:10 WIB cut-off operational day
 * - Max 50 Panel tolerances (A <= 5, B <= 8, C <= 10, D > 10)
 * - BS Awal & BS Akhir counted individually
 * - Additions from QC use '+ QC' badge, blue text #0070bc
 * - Tricote (T) concurrent handling
 */

(function (window) {
  "use strict";

  const QC_STORAGE_KEYS = {
    QC_QUEUE: "dji_offline_qc_queue",
    QC_CACHE: "dji_offline_qc_cache",
    ACTIVE_HEADER: "dji_qc_active_header"
  };

  // State
  const qcState = {
    nomorMc: "R01",
    potonganKe: 1,
    designId: "D-STANDARD",
    tanggalInspeksi: getOperationalDate(),
    petugas1: "INSPEKTOR 1",
    petugas2: "",
    mode: "PANEL", // PANEL or METER
    activeRoll: 1, // for Tricote
    panels: [], // list of inspected items
    isTricote: false
  };

  /**
   * Factory Operational Date helper (07:10 WIB cut-off)
   */
  function getOperationalDate() {
    const now = new Date();
    // Shift cut-off at 07:10:00
    const cutoff = new Date(now);
    cutoff.setHours(7, 10, 0, 0);

    if (now < cutoff) {
      // Still part of yesterday's operational day
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split("T")[0];
    }
    return now.toISOString().split("T")[0];
  }

  /**
   * Initialize default 50 panels for inspection or load from local storage
   */
  function initDefaultPanels() {
    qcState.isTricote = qcState.nomorMc.toUpperCase().startsWith("T");
    const panels = [];

    // 1. BS AWAL
    panels.push({
      id: "bs-awal-" + Date.now(),
      displayNo: "BS AWAL",
      status: "BS", // Default BS
      kategori: "A",
      detail: "Cacat Potongan Awal Roll",
      blok: "",
      isBsAwal: true,
      isBsAkhir: false,
      isTambahanQc: false,
      operatorName: "OPERATOR 1",
      group: "A",
      jam: "08:00"
    });

    // 2. Panel 1 to 50
    for (let i = 1; i <= 50; i++) {
      panels.push({
        id: "panel-" + i + "-" + Date.now(),
        displayNo: String(i),
        status: "OK", // Default OK (Ceklis)
        kategori: "",
        detail: "",
        blok: "",
        isBsAwal: false,
        isBsAkhir: false,
        isTambahanQc: false,
        operatorName: "OPERATOR 1",
        group: "A",
        jam: "08:15"
      });
    }

    // 3. BS AKHIR
    panels.push({
      id: "bs-akhir-" + Date.now(),
      displayNo: "BS AKHIR",
      status: "BS", // Default BS
      kategori: "A",
      detail: "Cacat Potongan Akhir Roll",
      blok: "",
      isBsAwal: false,
      isBsAkhir: true,
      isTambahanQc: false,
      operatorName: "OPERATOR 1",
      group: "A",
      jam: "14:00"
    });

    qcState.panels = panels;
  }

  /**
   * Calculate Overall Grade according to factory rules:
   * "untuk penentuan Grade Keseluruhan (Overall Grade), perhitungan cacat hanya dihitung berdasarkan panel BS saja (Grade B tidak termasuk).
   * Nilai panel BS AWAL serta BS AKHIR juga tetap disertakan dalam perhitungan total panel maupun total cacat BS.
   * Khusus kategori Max 50 Panel, batas toleransi cacat Grade C adalah maksimal 10 cacat (A <= 5, B <= 8, C <= 10), lebih dari 10 cacat baru mendapatkan Grade D."
   */
  function calculateOverallGrade() {
    let totalInspected = qcState.panels.length;
    let countOk = 0;
    let countDefect = 0;
    let countBS = 0;

    qcState.panels.forEach(p => {
      if (p.status === "BS") {
        countBS++;
      } else if (p.status === "DEFECT") {
        countDefect++;
      } else {
        countOk++;
      }
    });

    // Determine Grade based solely on BS count (Max 50 panel standard)
    let grade = "A";
    if (countBS <= 5) {
      grade = "A";
    } else if (countBS <= 8) {
      grade = "B";
    } else if (countBS <= 10) {
      grade = "C";
    } else {
      grade = "D";
    }

    return {
      grade,
      totalInspected,
      countOk,
      countDefect,
      countBS
    };
  }

  /**
   * Render Grade Card & Table
   */
  function renderQCView() {
    const stats = calculateOverallGrade();

    // Update Grade Card
    const badgeHuge = document.getElementById("qcOverallGradeBadge");
    if (badgeHuge) {
      badgeHuge.textContent = stats.grade;
      badgeHuge.className = `qc-grade-badge-huge grade-${stats.grade}`;
    }

    const txtGradeDesc = document.getElementById("qcGradeDescText");
    if (txtGradeDesc) {
      txtGradeDesc.textContent = `Grade ${stats.grade} berdasarkan toleransi pabrik (${stats.countBS} panel BS ditemukan). Grade B/cacat ringan tidak mempengaruhi grade keseluruhan.`;
    }

    const statTotal = document.getElementById("statTotalInspek");
    if (statTotal) statTotal.textContent = stats.totalInspected;

    const statOk = document.getElementById("statTotalOk");
    if (statOk) statOk.textContent = stats.countOk;

    const statDefect = document.getElementById("statTotalDefect");
    if (statDefect) statDefect.textContent = stats.countDefect;

    const statBS = document.getElementById("statTotalBS");
    if (statBS) statBS.textContent = stats.countBS;

    // Render Table Rows
    const tbody = document.getElementById("qcTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    qcState.panels.forEach((p, idx) => {
      const tr = document.createElement("tr");

      if (p.isTambahanQc) {
        tr.classList.add("qc-row-tambahan"); // bg-sky-50 per rule
      } else if (p.status === "BS") {
        tr.classList.add("qc-row-bs");
      }

      // Panel display
      let panelLabelHtml = `<strong>${p.displayNo}</strong>`;
      if (p.isDouble) {
        panelLabelHtml += `<br><span style="font-size:10px; color:#f59e0b; font-weight:800;">Double Panel</span>`;
      }
      if (p.isTambahanQc) {
        panelLabelHtml += `<br><span class="qc-badge-qc-tag">+ QC</span>`;
      }

      // Defect text styling rule: additions or QC notes are blue (#0070bc), operator defects are red
      let defectTextClass = p.isTambahanQc ? "qc-defect-text-blue" : "qc-defect-text-red";
      let defectInfo = p.detail || "-";
      if (p.blok) {
        defectInfo += ` (Blok ${p.blok})`;
      }

      tr.innerHTML = `
        <td style="color:var(--slate-500); font-size:11px;">${p.jam || '-'}</td>
        <td><strong style="color:var(--slate-800);">${p.operatorName || '-'}</strong> <span style="font-size:10px; color:var(--slate-500);">(${p.group || 'A'})</span></td>
        <td>${panelLabelHtml}</td>
        <td>
          <div class="qc-decision-group">
            <button type="button" class="qc-decision-btn ${p.status === 'OK' ? 'active-ok' : ''}" title="Normal / Ceklis" onclick="setPanelDecision('${p.id}', 'OK')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button type="button" class="qc-decision-btn ${p.status === 'DEFECT' ? 'active-defect' : ''}" title="Cacat / Silang" onclick="setPanelDecision('${p.id}', 'DEFECT')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button type="button" class="qc-decision-btn ${p.status === 'BS' ? 'active-bs' : ''}" title="Panel BS" onclick="setPanelDecision('${p.id}', 'BS')">
              <span style="font-size:11px; font-weight:900;">BS</span>
            </button>
          </div>
        </td>
        <td>
          <div class="${defectTextClass}">${defectInfo}</div>
        </td>
        <td style="text-align:right;">
          <button type="button" class="qc-quick-btn blue" style="padding:4px 8px; font-size:11px;" onclick="openEditDefectModal('${p.id}')">
            <span>Ubah Cacat</span>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    updateQueueCounter();
  }

  /**
   * Set panel inspection decision
   */
  function setPanelDecision(panelId, decision) {
    const panel = qcState.panels.find(p => p.id === panelId);
    if (!panel) return;

    panel.status = decision;
    if (decision === "OK") {
      panel.detail = "";
      panel.kategori = "";
      panel.blok = "";
    } else if (!panel.detail) {
      panel.detail = decision === "BS" ? "Cacat Kritis (Panel BS)" : "Cacat Rajut";
      panel.kategori = "B";
    }

    renderQCView();
  }

  /**
   * Quick Action: Set all panels to OK (Ceklis)
   */
  function markAllOk() {
    qcState.panels.forEach(p => {
      // BS Awal and BS Akhir stay BS per factory standard
      if (!p.isBsAwal && !p.isBsAkhir) {
        p.status = "OK";
        p.detail = "";
        p.kategori = "";
        p.blok = "";
      }
    });
    renderQCView();
    if (window.showToast) window.showToast("Semua panel ditandai Normal (Ceklis).");
  }

  /**
   * Quick Action: Insert missing defect panel (+ QC)
   * Rule: In accordance with workspace rules:
   * - Tambahan berlabel '+ QC'
   * - Background biru muda (bg-sky-50)
   * - Teks cacat berwarna biru (#0070bc)
   * - Panel berikutnya TIDAK otomatis bertambah, tetapi panel ditandai Double.
   */
  function insertQcPanel() {
    const panelNoStr = prompt("Masukkan nomor panel temuan QC yang ingin disisipkan (contoh: 12):");
    if (!panelNoStr) return;

    const panelNo = parseInt(panelNoStr, 10);
    if (isNaN(panelNo) || panelNo <= 0) {
      alert("Nomor panel tidak valid!");
      return;
    }

    const detailText = prompt("Keterangan cacat tambahan QC:", "Garis Jarum / Lubang Tambahan");

    const newPanel = {
      id: "qc-insert-" + Date.now(),
      displayNo: String(panelNo),
      status: "DEFECT",
      kategori: "B",
      detail: detailText || "Temuan Cacat QC",
      blok: "",
      isBsAwal: false,
      isBsAkhir: false,
      isTambahanQc: true,
      isDouble: true, // workspace rule: panel tidak bergeser, diberi label double
      operatorName: qcState.petugas1,
      group: "A",
      jam: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    };

    // Find position to insert right after the existing panel
    const existingIdx = qcState.panels.findIndex(p => p.displayNo === String(panelNo));
    if (existingIdx !== -1) {
      qcState.panels.splice(existingIdx + 1, 0, newPanel);
    } else {
      qcState.panels.push(newPanel);
    }

    renderQCView();
    if (window.showToast) window.showToast(`Panel #${panelNo} (+ QC) berhasil disisipkan!`);
  }

  /**
   * Save QC Inspection to Local Storage Queue
   */
  function saveInspectionLocally() {
    const stats = calculateOverallGrade();
    const batchPayload = {
      id: "qc-batch-" + Date.now(),
      type: "qc",
      nomorMc: qcState.nomorMc,
      potonganKe: qcState.potonganKe,
      designId: qcState.designId,
      tanggalInspeksi: qcState.tanggalInspeksi,
      petugas1: qcState.petugas1,
      stats: stats,
      items: qcState.panels,
      timestamp: new Date().toISOString()
    };

    let queue = [];
    try {
      const saved = localStorage.getItem(QC_STORAGE_KEYS.QC_QUEUE);
      if (saved) queue = JSON.parse(saved);
    } catch (e) {}

    queue.push(batchPayload);
    localStorage.setItem(QC_STORAGE_KEYS.QC_QUEUE, JSON.stringify(queue));

    updateQueueCounter();
    if (window.showToast) window.showToast(`Inspeksi Mc ${qcState.nomorMc} tersimpan di memori perangkat!`);
  }

  /**
   * Synchronize pending QC inspections to backend when connection is active
   */
  async function trySyncQcNow() {
    let queue = [];
    try {
      const saved = localStorage.getItem(QC_STORAGE_KEYS.QC_QUEUE);
      if (saved) queue = JSON.parse(saved);
    } catch (e) {}

    if (queue.length === 0) {
      if (window.showToast) window.showToast("Tidak ada antrean inspeksi QC lokal.");
      return;
    }

    if (!navigator.onLine) {
      if (window.showToast) window.showToast("Perangkat masih offline. Sinkronisasi ditunda.");
      return;
    }

    try {
      // Map batches to format accepted by /api/mobile/sync
      const syncItems = queue.map(b => ({
        id: b.id,
        type: "qc",
        timestamp: b.timestamp,
        data: {
          nomor_mc: b.nomorMc,
          potongan_ke: b.potonganKe,
          tanggal_inspeksi: b.tanggalInspeksi,
          petugas_inspeksi: b.petugas1,
          start_inspect: "08:00",
          finish_inspect: "08:30",
          prod_ceklis: b.stats.countOk,
          prod_silang: b.stats.countDefect,
          qc_ceklis: b.stats.countOk,
          qc_silang: b.stats.countDefect,
          details: b.items.map(it => ({
            detailId: it.id,
            finalInspectionId: it.status === "OK" ? 1 : (it.status === "BS" ? 4 : 3)
          }))
        }
      }));

      const res = await fetch("/api/mobile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: syncItems })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          localStorage.setItem(QC_STORAGE_KEYS.QC_QUEUE, JSON.stringify([]));
          updateQueueCounter();
          if (window.showToast) window.showToast(`Berhasil sinkron ${queue.length} laporan inspeksi QC ke server!`);
        }
      }
    } catch (err) {
      console.log("QC Background sync deferred:", err);
      if (window.showToast) window.showToast("Server belum terjangkau. Data tetap aman di memori lokal.");
    }
  }

  function updateQueueCounter() {
    let count = 0;
    try {
      const q = JSON.parse(localStorage.getItem(QC_STORAGE_KEYS.QC_QUEUE) || "[]");
      count = q.length;
    } catch (e) {}

    const el = document.getElementById("txtQcQueueCount");
    const banner = document.getElementById("qcQueueAlertBanner");
    if (el) el.textContent = `${count} data`;
    if (banner) {
      banner.style.display = count > 0 ? "flex" : "none";
    }
  }

  function initQCApp() {
    initDefaultPanels();
    renderQCView();

    // Auto sync check on online
    window.addEventListener("online", trySyncQcNow);
  }

  // Export to window
  window.DJIQC = {
    qcState,
    initQCApp,
    renderQCView,
    setPanelDecision,
    markAllOk,
    insertQcPanel,
    saveInspectionLocally,
    trySyncQcNow
  };

  window.addEventListener("DOMContentLoaded", initQCApp);
})(window);
