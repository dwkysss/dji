/**
 * API Synchronization (Live bootstrap, offline queue sync)
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, showToast, removePendingFromIDB } = window.DJIConfig;
  const { appState, syncSelectedMachineSnapshot, applyHeaderToCards, detectMachineMode } = window.DJIState;

  async function fetchLiveBootstrap() {
    try {
      const res = await fetch("/api/mobile/bootstrap");
      if (!res.ok) return;
      const data = await res.json();
      if (!data || (!data.machines && !data.snapshots)) return;

      appState.bootstrap = data;
      localStorage.setItem(KEYS.BOOTSTRAP, JSON.stringify(data));

      // Auto-assign default operator & group from current active shift if none saved
      const hasCustomHeader = Boolean(localStorage.getItem(KEYS.HEADER));
      if (!hasCustomHeader && data.shiftInfo && data.operators && !appState.selectedOperator) {
        const shiftNum = data.shiftInfo.shiftNumber || "1";
        const shiftLetter = shiftNum === "1" ? "A" : shiftNum === "2" ? "B" : "C";
        appState.selectedGroup = shiftLetter;
        const matchingOp = data.operators.find(o => (o.shift || "").toUpperCase() === shiftLetter);
        if (matchingOp) {
          appState.selectedOperator = matchingOp.name;
        } else if (data.operators.length > 0) {
          appState.selectedOperator = data.operators[0].name;
        }
      }

      syncSelectedMachineSnapshot(appState.selectedMc);
      if (window.DJIHeaderModal && window.DJIHeaderModal.populateSelectors) {
        window.DJIHeaderModal.populateSelectors();
      }
      applyHeaderToCards();
      detectMachineMode(appState.selectedMc);
    } catch (err) {
      console.log("Bootstrap live sync deferred:", err);
    }
  }

  function refreshQueueBadge() {
    let queue = [];
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      if (savedQ) queue = JSON.parse(savedQ);
    } catch (e) {}

    const banner = document.getElementById("offlineQueueAlert");
    const badgeCount = document.getElementById("txtOfflineQueueCount");

    if (queue.length > 0) {
      if (banner) banner.style.display = "flex";
      if (badgeCount) badgeCount.textContent = `${queue.length} data`;
    } else {
      if (banner) banner.style.display = "none";
    }
  }

  async function trySyncQueueNow() {
    if (!navigator.onLine) {
      showToast("Tidak ada koneksi internet. Data tetap aman di memori perangkat.");
      return;
    }

    let queue = [];
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      if (savedQ) queue = JSON.parse(savedQ);
    } catch (e) {}

    if (queue.length === 0) {
      showToast("Semua data telah tersinkronisasi.");
      return;
    }

    // Format items to match backend /api/mobile/sync expectation
    const itemsToSend = queue.map(item => ({
      id: item.id,
      type: item.type || (item.inputType === "METER" ? "continuous" : "employee"),
      timestamp: item.timestamp,
      data: item.data || item
    }));

    try {
      const res = await fetch("/api/mobile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToSend })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          const succeededIds = new Set(result.succeeded || []);

          // Hapus item yang berhasil dari IndexedDB
          for (const sId of succeededIds) {
            if (removePendingFromIDB) await removePendingFromIDB(sId);
          }

          // Perbarui antrean localStorage
          const remainingQueue = queue.filter(item => !succeededIds.has(item.id));
          localStorage.setItem(KEYS.QUEUE, JSON.stringify(remainingQueue));

          refreshQueueBadge();
          renderQueueList();

          const countSuccess = succeededIds.size;
          if (countSuccess > 0) {
            showToast(`Berhasil sinkronisasi ${countSuccess} data ke database!`);
          }

          if (result.failed && result.failed.length > 0) {
            console.warn("Sebagian data gagal tersimpan:", result.failed);
            showToast(`⚠️ ${result.failed.length} data tertunda: ${result.failed[0]?.error || 'Cek koneksi'}`);
          }
        }
      }
    } catch (err) {
      console.log("Background sync deferred - server unreachable:", err);
    }
  }

  function getQueue() {
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      return savedQ ? JSON.parse(savedQ) : [];
    } catch (e) {
      return [];
    }
  }

  async function deleteQueueItem(id) {
    if (!confirm("Hapus data input produksi ini dari antrean offline?")) return;
    let queue = getQueue();
    queue = queue.filter(item => item.id !== id);
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));

    if (removePendingFromIDB) {
      await removePendingFromIDB(id);
    }

    refreshQueueBadge();
    renderQueueList();
    showToast("Data produksi dihapus dari antrean.");
  }

  function renderQueueList() {
    const container = document.getElementById("queueListContainer");
    const badgeModal = document.getElementById("badgeQueueModalCount");
    if (!container) return;

    const queue = getQueue();
    if (badgeModal) badgeModal.textContent = `${queue.length} antrean`;

    if (queue.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:36px 16px; color:#94a3b8; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px; height:36px; color:#cbd5e1;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span style="font-size:13px; font-weight:700; color:#64748b;">Antrean Kosong</span>
          <span style="font-size:11px;">Semua data telah tersinkronisasi atau belum ada transaksi baru.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    queue.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "queue-item-card";

      const isStatus = item.type === "status" || item.panelNo === "BERHENTI";
      const isMeter = item.inputType === "METER";
      const numLabel = isStatus
        ? "MESIN MATI"
        : (isMeter ? `Meter ${item.meterAwal}m - ${item.meterAkhir}m` : `Panel #${item.panelNo}`);
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
      const isIstirahat = item.jenisLaporan && item.jenisLaporan.includes("Istirahat");
      const badgeKindLabel = isStatus ? "MESIN MATI" : (isIstirahat ? "ISTIRAHAT" : "NORMAL");
      const badgeKindClass = isStatus ? "bg-rose-500" : (isIstirahat ? "istirahat" : "normal");

      card.innerHTML = `
        <div class="queue-item-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="queue-badge-mc">${item.nomorMc}</span>
            <span class="queue-badge-panel" style="${isStatus ? 'background:#fee2e2; color:#b91c1c;' : ''}">${numLabel}</span>
          </div>
          <span class="queue-badge-kind ${badgeKindClass}" style="${isStatus ? 'background:#e11d48; color:#ffffff;' : ''}">${badgeKindLabel}</span>
        </div>

        <div class="queue-item-meta">
          <span>Potongan #${item.potonganKe || 1}</span>
          <span>•</span>
          <span>Desain: ${item.designId || '-'}</span>
          <span>•</span>
          <span>Operator: ${item.operatorName || '-'} (Shift ${item.groupId || 'A'})</span>
          <span>•</span>
          <span>Jam: ${timeStr}</span>
          ${item.isPotongKain ? `<span style="background:#ffe4e6; color:#e11d48; font-weight:800; padding:1px 6px; border-radius:4px; font-size:10px;">Potong Kain</span>` : ''}
          ${(item.isPanelBs || item.isBs || (item.panelNo && item.panelNo.includes('(BS)'))) ? `<span style="background:#fee2e2; color:#b91c1c; font-weight:800; padding:1px 6px; border-radius:4px; font-size:10px;">⚠️ Panel BS</span>` : ''}
          ${(item.downtimeEvents && item.downtimeEvents.length > 0) ? `<span style="background:#fef3c7; color:#b45309; font-weight:800; padding:1px 6px; border-radius:4px; font-size:10px;">${item.downtimeEvents.length} Downtime</span>` : ''}
        </div>

        <div class="queue-item-footer">
          <span style="font-size:10px; font-weight:800; color:#d97706; display:flex; align-items:center; gap:5px;">
            <span class="dot-ping-amber" style="width:6px; height:6px;"></span>
            <span>Tersimpan di Memori HP</span>
          </span>
          <button type="button" class="btn-delete-queue-item" onclick="DJIApi.deleteQueueItem('${item.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>Hapus</span>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function openQueueModal() {
    renderQueueList();
    const modal = document.getElementById("modalQueue");
    if (modal) modal.classList.add("show");
  }

  function closeQueueModal() {
    const modal = document.getElementById("modalQueue");
    if (modal) modal.classList.remove("show");
  }

  window.DJIApi = {
    fetchLiveBootstrap,
    refreshQueueBadge,
    trySyncQueueNow,
    getQueue,
    deleteQueueItem,
    renderQueueList,
    openQueueModal,
    closeQueueModal
  };
})(window);
