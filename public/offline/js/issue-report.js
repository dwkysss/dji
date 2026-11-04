/**
 * Issue Report Management (Offline & Online)
 * Dentelle Jaya Infinitex - Fitur Lapor Kesalahan Input & Kendala Mesin
 */

(function (window) {
  "use strict";

  const STORAGE_KEY = "dji_offline_issue_reports";
  let activeTab = "form";
  let reportsCache = [];
  let isSubmitting = false;

  function openIssueReportModal() {
    const modal = document.getElementById("modalIssueReport");
    if (!modal) return;

    // Ambil info otomatis dari header aktif
    const appState = (window.DJIState && window.DJIState.appState) || {};
    const mc = appState.selectedMc || "R1";
    const pot = appState.selectedPotongan || 1;
    const group = appState.selectedGroup || "A";
    const sender = appState.selectedOperator || "Operator";

    const dispMc = document.getElementById("dispReportMc");
    const dispPot = document.getElementById("dispReportPotongan");
    const dispGroup = document.getElementById("dispReportGroup");
    const dispSender = document.getElementById("dispReportSender");
    const txtKet = document.getElementById("txtReportKeterangan");

    if (dispMc) dispMc.textContent = mc;
    if (dispPot) dispPot.textContent = "#" + pot;
    if (dispGroup) dispGroup.textContent = "Group " + group;
    if (dispSender) dispSender.textContent = sender;
    if (txtKet) txtKet.value = "";

    switchIssueReportTab("form");
    modal.classList.add("show");
    modal.style.display = "flex";

    // Muat daftar laporan di latar belakang
    loadIssueReports();
  }

  function closeIssueReportModal() {
    const modal = document.getElementById("modalIssueReport");
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  }

  function switchIssueReportTab(tab) {
    activeTab = tab;
    const btnForm = document.getElementById("btnTabReportForm");
    const btnList = document.getElementById("btnTabReportList");
    const viewForm = document.getElementById("viewReportForm");
    const viewList = document.getElementById("viewReportList");

    if (btnForm) btnForm.classList.toggle("active", tab === "form");
    if (btnList) btnList.classList.toggle("active", tab === "list");
    if (viewForm) viewForm.style.display = tab === "form" ? "block" : "none";
    if (viewList) viewList.style.display = tab === "list" ? "block" : "none";

    if (tab === "list") {
      renderReportsList();
    }
  }

  async function loadIssueReports() {
    let list = [];
    // 1. Ambil dari localStorage (offline queue)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) {}

    // 2. Jika online, ambil dari server
    if (navigator.onLine) {
      try {
        const baseUrl = typeof DJIConfig !== "undefined" && DJIConfig.getApiBaseUrl ? DJIConfig.getApiBaseUrl() : "";
        const res = await fetch(baseUrl + "/api/mobile/issue-reports");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const offlineIds = new Set(list.map((o) => o.id));
            const uniqueServer = json.data.filter((s) => !offlineIds.has(s.id));
            list = [...list, ...uniqueServer];
          }
        }
      } catch (e) {
        console.warn("[loadIssueReports] Offline / network error:", e);
      }
    }

    reportsCache = list;
    updatePendingBadge();
    if (activeTab === "list") {
      renderReportsList();
    }
  }

  function updatePendingBadge() {
    const badge = document.getElementById("badgePendingReportsCount");
    if (!badge) return;
    const count = reportsCache.filter((r) => r.status === "PENDING").length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }

  async function submitIssueReport() {
    if (isSubmitting) return;

    const appState = (window.DJIState && window.DJIState.appState) || {};
    const mc = appState.selectedMc || "R1";
    const pot = appState.selectedPotongan || 1;
    const group = appState.selectedGroup || "A";
    const sender = appState.selectedOperator || "Operator";
    const ket = document.getElementById("txtReportKeterangan")?.value || "";

    if (!ket.trim()) {
      if (typeof showToast === "function") showToast("Mohon tuliskan laporan atau kendala!", "error");
      else alert("Mohon tuliskan laporan atau kendala!");
      return;
    }

    isSubmitting = true;
    const payload = {
      category: "KESALAHAN_INPUT",
      nomorMc: mc.toUpperCase(),
      potonganKe: Number(pot),
      groupName: group,
      keterangan: ket.trim(),
      senderName: sender,
    };

    const reportId = "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const itemData = {
      id: reportId,
      ...payload,
      status: "PENDING",
      resolutionNotes: "",
      resolvedBy: "",
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    // Simpan ke offline cache terlebih dahulu
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(itemData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}

    // Coba kirim langsung jika online
    if (navigator.onLine) {
      try {
        const baseUrl = typeof DJIConfig !== "undefined" && DJIConfig.getApiBaseUrl ? DJIConfig.getApiBaseUrl() : "";
        const res = await fetch(baseUrl + "/api/mobile/issue-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            try {
              const raw = localStorage.getItem(STORAGE_KEY);
              if (raw) {
                const list = JSON.parse(raw).filter((x) => x.id !== reportId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
              }
            } catch (e) {}
            itemData.id = json.data.id;
          }
        }
      } catch (e) {
        console.warn("[submitIssueReport] Offline queued:", e);
      }
    }

    isSubmitting = false;
    if (typeof showToast === "function") {
      showToast("Laporan berhasil dikirim ke tim QC!", "success");
    }

    // Reset input & buka tab riwayat
    const txtKet = document.getElementById("txtReportKeterangan");
    if (txtKet) txtKet.value = "";
    loadIssueReports();
    switchIssueReportTab("list");
  }

  function renderReportsList() {
    const container = document.getElementById("listIssueReportsContainer");
    if (!container) return;

    if (!reportsCache || reportsCache.length === 0) {
      container.innerHTML = `
        <div style="padding:32px 16px; text-align:center; color:#94a3b8; font-size:12px;">
          <p style="font-weight:700;">Belum ada laporan kesalahan</p>
          <p style="font-size:11px; margin-top:4px;">Gunakan tab "Buat Laporan Baru" jika ada salah input atau kendala mesin.</p>
        </div>
      `;
      return;
    }

    let html = "";
    reportsCache.forEach((r) => {
      const isPending = r.status === "PENDING";
      const statusBadge = isPending
        ? '<span style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; border-radius:999px; background:#f59e0b; flex-shrink:0;"></span>Menunggu</span>'
        : '<span style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; text-transform:uppercase; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; border-radius:999px; background:#10b981; flex-shrink:0;"></span>Sudah Diperbaiki</span>';

      const dateStr = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const solutionBox = !isPending && r.resolutionNotes
        ? `
          <div style="margin-top:8px; padding:8px 10px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; font-size:11px; color:#065f46;">
            <strong>Catatan Perbaikan:</strong> ${r.resolutionNotes}
            <div style="font-size:9px; color:#059669; margin-top:3px;">Oleh ${r.resolvedBy || "Admin / QC"}</div>
          </div>
        `
        : "";

      const actionBtn = isPending
        ? `<button type="button" onclick="DJIIssueReport.markResolved('${r.id}')" style="padding:4px 10px; border-radius:8px; background:#ecfdf5; border:1px solid #6ee7b7; color:#047857; font-size:11px; font-weight:700; cursor:pointer;">✓ Tandai Sudah Diperbaiki</button>`
        : `<button type="button" onclick="DJIIssueReport.reopenReport('${r.id}')" style="padding:4px 10px; border-radius:8px; background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; font-size:11px; font-weight:700; cursor:pointer;">↺ Buka Kembali</button>`;

      html += `
        <div style="padding:12px; border-radius:14px; border:1px solid ${isPending ? "#fcd34d" : "#e2e8f0"}; background:${isPending ? "#fffbeb" : "#ffffff"}; margin-bottom:10px; text-align:left;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="background:#e2e8f0; color:#1e293b; font-size:11px; font-weight:800; padding:2px 6px; border-radius:6px;">${r.nomorMc}</span>
              ${r.potonganKe ? `<span style="font-size:11px; font-weight:700; color:#0070bc;">Pot. #${r.potonganKe}</span>` : ""}
              ${r.groupName ? `<span style="background:#fef3c7; color:#b45309; font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px;">Group ${r.groupName}</span>` : ""}
              <span style="font-size:10px; color:#94a3b8;">👤 ${r.senderName} • ${dateStr}</span>
            </div>
            ${statusBadge}
          </div>
          <div style="font-size:12px; color:#1e293b; line-height:1.4; background:rgba(255,255,255,0.7); padding:8px; border-radius:8px; border:1px solid rgba(0,0,0,0.05); white-space:pre-wrap;">${r.keterangan}</div>
          ${solutionBox}
          <div style="display:flex; align-items:center; justify-content:flex-end; margin-top:8px;">
            ${actionBtn}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async function markResolved(reportId) {
    const note = prompt("Catatan perbaikan / tindakan yang sudah dilakukan (opsional):", "Sudah diperiksa & dikoreksi");
    if (note === null) return;

    const resolver = (window.DJIState && window.DJIState.appState.selectedOperator) || "Admin / QC";
    
    reportsCache = reportsCache.map((r) =>
      r.id === reportId
        ? { ...r, status: "RESOLVED", resolutionNotes: note, resolvedBy: resolver, resolvedAt: new Date().toISOString() }
        : r
    );
    renderReportsList();
    updatePendingBadge();

    if (navigator.onLine) {
      try {
        const baseUrl = typeof DJIConfig !== "undefined" && DJIConfig.getApiBaseUrl ? DJIConfig.getApiBaseUrl() : "";
        await fetch(baseUrl + "/api/mobile/issue-reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: reportId,
            status: "RESOLVED",
            resolutionNotes: note,
            resolvedBy: resolver,
          }),
        });
      } catch (e) {}
    }
    if (typeof showToast === "function") showToast("Laporan ditandai: Sudah Diperbaiki", "success");
  }

  async function reopenReport(reportId) {
    reportsCache = reportsCache.map((r) =>
      r.id === reportId
        ? { ...r, status: "PENDING", resolutionNotes: "", resolvedBy: "", resolvedAt: null }
        : r
    );
    renderReportsList();
    updatePendingBadge();

    if (navigator.onLine) {
      try {
        const baseUrl = typeof DJIConfig !== "undefined" && DJIConfig.getApiBaseUrl ? DJIConfig.getApiBaseUrl() : "";
        await fetch(baseUrl + "/api/mobile/issue-reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: reportId,
            status: "PENDING",
            resolutionNotes: "",
            resolvedBy: "",
          }),
        });
      } catch (e) {}
    }
  }

  // Sinkronisasi antrean laporan offline saat online
  async function syncOfflineReports() {
    if (!navigator.onLine) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const baseUrl = typeof DJIConfig !== "undefined" && DJIConfig.getApiBaseUrl ? DJIConfig.getApiBaseUrl() : "";
      const remaining = [];

      for (const item of queue) {
        try {
          const res = await fetch(baseUrl + "/api/mobile/issue-reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: item.category,
              nomorMc: item.nomorMc,
              potonganKe: item.potonganKe,
              groupName: item.groupName,
              keterangan: item.keterangan,
              senderName: item.senderName,
            }),
          });
          if (!res.ok) remaining.push(item);
        } catch (err) {
          remaining.push(item);
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      loadIssueReports();
    } catch (e) {}
  }

  window.addEventListener("online", syncOfflineReports);

  window.DJIIssueReport = {
    openModal: openIssueReportModal,
    closeModal: closeIssueReportModal,
    switchTab: switchIssueReportTab,
    submitReport: submitIssueReport,
    loadReports: loadIssueReports,
    markResolved: markResolved,
    reopenReport: reopenReport,
    syncOfflineReports: syncOfflineReports,
  };

  window.openIssueReportModal = openIssueReportModal;
  window.closeIssueReportModal = closeIssueReportModal;
})(window);
