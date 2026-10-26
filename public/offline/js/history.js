/**
 * History Drawer (Recent panels/rolls for active cut)
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS } = window.DJIConfig;
  const { appState } = window.DJIState;

  function openHistoryDrawer() {
    const container = document.getElementById("historyListContainer");
    if (!container) return;
    container.innerHTML = "";

    const activeMc = (appState.selectedMc || "").toUpperCase();
    const activePotongan = String(appState.selectedPotongan || 1);

    // 1. Ambil data lokal yang baru saja disimpan di perangkat ini
    let localItems = [];
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      if (savedQ) {
        const queue = JSON.parse(savedQ);
        localItems = queue.filter(item => {
          const matchMc = String(item.nomorMc || "").toUpperCase() === activeMc;
          const matchPot = String(item.potonganKe || "") === activePotongan;
          return matchMc && matchPot;
        });
      }
    } catch (e) {
      console.warn("Gagal membaca antrean lokal untuk riwayat:", e);
    }

    // 2. Ambil riwayat dari server bootstrap snapshot
    let serverItems = [];
    if (appState.bootstrap && appState.bootstrap.snapshots && appState.bootstrap.snapshots[activeMc]) {
      const snap = appState.bootstrap.snapshots[activeMc];
      serverItems = snap.recentPanels || snap.recentItems || [];
    }

    // Header info bar di dalam modal riwayat
    const headerInfo = document.createElement("div");
    headerInfo.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:10px 14px; border-radius:12px; margin-bottom:12px; font-size:12px; font-weight:800; color:#334155;";
    headerInfo.innerHTML = `
      <span>Mesin ${appState.selectedMc || '-'} • Potongan #${appState.selectedPotongan || 1}</span>
      <span style="font-size:11px; color:#64748b;">${localItems.length} antrean lokal, ${serverItems.length} server</span>
    `;
    container.appendChild(headerInfo);

    if (localItems.length === 0 && serverItems.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.style.cssText = "text-align:center; padding:36px 16px; color:#94a3b8; font-size:13px; font-weight:600; display:flex; flex-direction:column; align-items:center; gap:8px;";
      emptyDiv.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px; height:36px; color:#cbd5e1;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Belum ada riwayat panel pada potongan #${appState.selectedPotongan || 1}.</span>
      `;
      container.appendChild(emptyDiv);
    } else {
      const listWrapper = document.createElement("div");
      listWrapper.style.cssText = "display:flex; flex-direction:column; gap:8px; max-height:480px; overflow-y:auto; padding-right:2px;";

      // Render local items terlebih dahulu (paling baru di atas)
      [...localItems].reverse().forEach(item => {
        const isMeter = item.inputType === "METER";
        const title = isMeter
          ? `Meter ${item.meterAwal}m - ${item.meterAkhir}m`
          : `Panel #${item.panelNo}`;
        const timeStr = item.timestamp
          ? new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : "-";

        const card = document.createElement("div");
        card.style.cssText = "display:flex; flex-direction:column; gap:6px; padding:12px; border-radius:12px; border:1px solid #fde68a; background:#fffbeb;";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:900; color:#78350f;">${title}</span>
              <span style="font-size:9px; font-weight:900; padding:2px 6px; border-radius:4px; background:#fef3c7; color:#92400e; border:1px solid #fcd34d;">ANTREAN HP</span>
            </div>
            <span style="font-size:11px; font-weight:700; color:#b45309;">${timeStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px;">
            <span style="color:#64748b;">Op: <strong>${item.operatorName || '-'}</strong></span>
            ${item.isPotongKain ? `<span style="font-size:10px; font-weight:800; background:#0284c7; color:#ffffff; padding:1px 6px; border-radius:4px;">✂️ Potong Kain</span>` : ''}
            ${(item.isPanelBs || item.isBs || (item.panelNo && item.panelNo.includes('(BS)'))) ? `<span style="font-size:10px; font-weight:800; background:#ef4444; color:#ffffff; padding:1px 6px; border-radius:4px;">⚠️ Panel BS</span>` : ''}
            ${item.jenisLaporan && item.jenisLaporan.includes("Istirahat") ? `<span style="font-size:10px; font-weight:800; background:#f59e0b; color:#ffffff; padding:1px 6px; border-radius:4px;">Istirahat</span>` : ''}
            ${item.downtimeEvents && item.downtimeEvents.length > 0 ? `<span style="font-size:10px; font-weight:800; background:#fde68a; color:#78350f; padding:1px 6px; border-radius:4px;">${item.downtimeEvents.length} Downtime</span>` : ''}
          </div>
        `;
        listWrapper.appendChild(card);
      });

      // Render server snapshot items
      serverItems.forEach(item => {
        const isMeter = Boolean(item.meterAkhir || item.meter_akhir);
        const title = isMeter
          ? `Meter ${item.meterAwal || item.meter_awal || 0}m - ${item.meterAkhir || item.meter_akhir}m`
          : `Panel #${item.panelNo || item.panel_no || '-'}`;
        const rawTime = item.tanggalJam || item.tanggal_jam || item.createdAt || item.created_at;
        const timeStr = rawTime
          ? new Date(rawTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : "-";
        const status = item.statusCacat || item.status_cacat || item.jenisLaporan || (item.isBs || item.is_bs ? "BS" : "NORMAL");

        const card = document.createElement("div");
        card.style.cssText = "display:flex; flex-direction:column; gap:6px; padding:12px; border-radius:12px; border:1px solid var(--slate-200); background:#f8fafc;";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px; font-weight:900; color:var(--slate-800);">${title}</span>
              <span style="font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; background:#e0f2fe; color:#0284c7;">SERVER</span>
            </div>
            <span style="font-size:11px; font-weight:700; color:var(--slate-500);">${timeStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px;">
            <span style="font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; background:${status.includes('BS') ? '#fee2e2' : '#f0fdf4'}; color:${status.includes('BS') ? '#b91c1c' : '#15803d'};">
              ${status}
            </span>
            ${item.detailMasalah || item.detail_masalah ? `<span style="color:#64748b; font-size:10px;">${item.detailMasalah || item.detail_masalah}</span>` : ''}
          </div>
        `;
        listWrapper.appendChild(card);
      });

      container.appendChild(listWrapper);
    }

    const drawer = document.getElementById("modalHistory");
    if (drawer) drawer.classList.add("show");
  }

  function closeHistoryDrawer() {
    const drawer = document.getElementById("modalHistory");
    if (drawer) drawer.classList.remove("show");
  }

  window.DJIHistory = {
    openHistoryDrawer,
    closeHistoryDrawer
  };
})(window);
