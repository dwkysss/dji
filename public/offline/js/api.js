/**
 * API Synchronization (Live bootstrap, offline queue sync)
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const {
    KEYS,
    showToast,
    removePendingFromIDB,
    getApiBaseUrl,
    resolveOperatorId,
    resolveOperatorName
  } = window.DJIConfig;
  const { appState, syncSelectedMachineSnapshot, applyHeaderToCards, detectMachineMode } = window.DJIState;

  let onlineRestoreTimer = null;
  let onlineCountdownInterval = null;

  function updateNetworkStatusUI(isOnline) {
    const pill = document.querySelector(".pill-offline-indicator");
    const txt = document.getElementById("txtNetworkStatus");
    const dot = document.getElementById("dotNetworkStatus");
    const btnReturn = document.getElementById("btnReturnToOnline");
    if (!pill) return;

    if (isOnline) {
      pill.classList.remove("offline");
      pill.classList.add("online");
      pill.style.background = "";
      pill.style.borderColor = "";
      pill.style.color = "";
      if (txt) {
        const isQc = window.location.pathname.includes("offline-qc");
        txt.textContent = isQc ? "QC ONLINE" : "ONLINE";
      }
      if (dot) {
        dot.classList.add("online");
        dot.style.background = "";
        dot.style.boxShadow = "";
      }
      pill.title = "Terhubung ke Server (Klik untuk kembali ke portal utama)";
      if (btnReturn) btnReturn.style.display = "inline-flex";
    } else {
      pill.classList.remove("online");
      pill.classList.add("offline");
      pill.style.background = "";
      pill.style.borderColor = "";
      pill.style.color = "";
      if (txt) {
        const isQc = window.location.pathname.includes("offline-qc");
        txt.textContent = isQc ? "QC OFFLINE" : "OFFLINE";
      }
      if (dot) {
        dot.classList.remove("online");
        dot.style.background = "";
        dot.style.boxShadow = "";
      }
      pill.title = "Mode Offline (Data tersimpan di perangkat lokal)";
      if (btnReturn) btnReturn.style.display = "none";
      dismissOnlineBanner();
    }
  }

  function dismissOnlineBanner() {
    if (onlineRestoreTimer) {
      clearTimeout(onlineRestoreTimer);
      onlineRestoreTimer = null;
    }
    if (onlineCountdownInterval) {
      clearInterval(onlineCountdownInterval);
      onlineCountdownInterval = null;
    }
    const banner = document.getElementById("onlineRestoreBanner");
    if (banner) banner.style.display = "none";
  }

  function stayInOfflineMode() {
    dismissOnlineBanner();
    try {
      sessionStorage.setItem("dji_stay_offline", "1");
    } catch (e) {}
    showToast("Tetap di halaman offline. Gunakan tombol 'Kembali ke Portal' di atas jika ingin kembali.");
  }

  async function returnToOnlinePortal(force = false) {
    if (force) {
      try {
        sessionStorage.removeItem("dji_stay_offline");
      } catch (e) {}
    } else {
      try {
        if (sessionStorage.getItem("dji_stay_offline") === "1" || window.location.search.includes("stay=1") || window.location.search.includes("stay=true")) {
          return;
        }
      } catch (e) {}
    }
    dismissOnlineBanner();

    // Pastikan antrean tersinkron terlebih dahulu sebelum pindah ke online
    if (navigator.onLine && getQueue().length > 0) {
      try {
        showToast("Menyinkronkan sisa antrean ke server...");
        await trySyncQueueNow();
      } catch (e) {}
    }
    const baseUrl = getApiBaseUrl ? getApiBaseUrl() : "";
    const isQc = window.location.pathname.includes("offline-qc");
    const isMeter = appState && appState.currentMode === "METER";
    const targetPath = isQc ? "/qc" : (isMeter ? "/input-meter" : "/input");

    // Catat waktu redirect attempt untuk proteksi loop
    try {
      const currentCount = parseInt(sessionStorage.getItem("dji_redirect_count") || "0", 10);
      sessionStorage.setItem("dji_redirect_count", String(currentCount + 1));
      sessionStorage.setItem("dji_last_redirect_time", String(Date.now()));
    } catch (e) {}
    const targetUrl = baseUrl ? `${baseUrl}${targetPath}` : targetPath;

    // Simpan data header aktif ke localStorage agar sinkron saat membuka halaman online
    if (appState) {
      try {
        const opId = (resolveOperatorId && appState.selectedOperator)
          ? resolveOperatorId(appState.selectedOperator, appState.bootstrap)
          : "";
        const h = {
          nomorMc: appState.selectedMc,
          potonganKe: String(appState.selectedPotongan),
          operatorName: appState.selectedOperator,
          operatorId: opId,
          groupId: appState.selectedGroup,
          designId: appState.selectedDesign,
          statusMatching: appState.selectedMatching,
          rpm: appState.rpm,
          pick: appState.pick,
          course: appState.course,
          noOrderBarang: appState.noOrderBarang,
          noCustomer: appState.noCustomer,
          jenisBenangDasar: appState.jenisBenangDasar,
          liner: appState.liner,
          heavy: appState.heavy,
          shadow: appState.shadow,
          pinggiran: appState.pinggiran,
          updatedAt: Date.now()
        };
        localStorage.setItem(KEYS.HEADER, JSON.stringify(h));
        localStorage.setItem(KEYS.LAST_MC || "dji_last_selected_mc", appState.selectedMc);
        localStorage.setItem("last_input_route", targetPath);
        if (appState.selectedOperator && appState.selectedOperator !== "-") {
          localStorage.setItem(KEYS.ACTIVE_OPERATOR_NAME || "dji_active_operator_name", appState.selectedOperator);
          if (opId) localStorage.setItem(KEYS.ACTIVE_OPERATOR_ID || "dji_active_operator_id", String(opId));
        }

        // Sinkronkan juga draft form online
        try {
          const rawDraft = localStorage.getItem("dji_form_draft_panel");
          if (rawDraft) {
            const parsed = JSON.parse(rawDraft);
            parsed.potonganKe = String(appState.selectedPotongan);
            parsed.nomorMc = appState.selectedMc;
            parsed.panelNo = "1";
            parsed.updatedAt = Date.now();
            localStorage.setItem("dji_form_draft_panel", JSON.stringify(parsed));
          }
          const rawMeter = localStorage.getItem("dji_form_draft_continuous");
          if (rawMeter) {
            const parsedM = JSON.parse(rawMeter);
            parsedM.potonganKe = String(appState.selectedPotongan);
            parsedM.nomorMc = appState.selectedMc;
            parsedM.updatedAt = Date.now();
            localStorage.setItem("dji_form_draft_continuous", JSON.stringify(parsedM));
          }
        } catch (e) {}
      } catch (e) {}
    }

    showToast("Mengalihkan ke Portal Utama...");
    const ts = Date.now();
    const sep = targetUrl.includes("?") ? "&" : "?";
    window.location.replace(`${targetUrl}${sep}online=${ts}`);
  }

  function handleNetworkPillClick() {
    if (navigator.onLine) {
      returnToOnlinePortal(true);
    } else {
      fetchLiveBootstrap();
    }
  }

  function notifyOnlineRestored() {
    // 1. Jika operator sengaja memilih "Tetap di Offline" pada sesi ini, jangan paksa auto-redirect
    try {
      if (sessionStorage.getItem("dji_stay_offline") === "1" || window.location.search.includes("stay=1") || window.location.search.includes("stay=true")) return;
    } catch (e) {}

    // 2. Jika countdown sudah aktif berjalan, biarkan berjalan sampai redirect, jangan reset
    if (onlineRestoreTimer) {
      return;
    }

    // 3. CEK PROTEKSI LOOP: Jika redirect mental >= 3x berturut-turut dalam 5 detik
    try {
      const redirectCount = parseInt(sessionStorage.getItem("dji_redirect_count") || "0", 10);
      const lastRedirectTime = parseInt(sessionStorage.getItem("dji_last_redirect_time") || "0", 10);
      if (Date.now() - lastRedirectTime < 5000 && redirectCount >= 3) {
        const banner = document.getElementById("onlineRestoreBanner");
        const msg = document.getElementById("txtOnlineRestoreMsg");
        if (banner) banner.style.display = "flex";
        if (msg) {
          msg.innerHTML = "Data tersinkron. Klik <b>Kembali Sekarang</b> jika ingin beralih ke portal utama.";
        }
        return;
      }
    } catch (e) {}

    const banner = document.getElementById("onlineRestoreBanner");
    const msg = document.getElementById("txtOnlineRestoreMsg");
    const lblCountdown = document.getElementById("lblOnlineCountdown");
    if (!banner) return;

    banner.style.display = "flex";
    let secondsLeft = 3;
    if (msg) {
      msg.innerHTML = 'Data tersinkron. Mengalihkan ke Portal Utama dalam <b id="lblOnlineCountdown" style="color: #0f172a; font-size: 13px;">' + secondsLeft + '</b> detik...';
    } else if (lblCountdown) {
      lblCountdown.textContent = secondsLeft;
    }

    if (onlineCountdownInterval) clearInterval(onlineCountdownInterval);

    onlineCountdownInterval = setInterval(() => {
      secondsLeft -= 1;
      const countEl = document.getElementById("lblOnlineCountdown");
      if (countEl) countEl.textContent = Math.max(0, secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(onlineCountdownInterval);
        onlineCountdownInterval = null;
      }
    }, 1000);

    onlineRestoreTimer = setTimeout(() => {
      onlineRestoreTimer = null;
      returnToOnlinePortal();
    }, 3200);
  }

  async function fetchLiveBootstrap() {
    try {
      const baseUrl = getApiBaseUrl ? getApiBaseUrl() : "";
      const res = await fetch(baseUrl + "/api/mobile/bootstrap");
      if (!res.ok) {
        updateNetworkStatusUI(false);
        return;
      }
      const data = await res.json();
      if (!data || (!data.machines && !data.snapshots)) {
        updateNetworkStatusUI(false);
        return;
      }

      appState.bootstrap = data;
      localStorage.setItem(KEYS.BOOTSTRAP, JSON.stringify(data));
      updateNetworkStatusUI(true);

      // Cek apakah header di localStorage valid untuk mesin aktif
      let needsFreshSnapshot = true;
      try {
        const rawHeader = localStorage.getItem(KEYS.HEADER);
        if (rawHeader) {
          const p = JSON.parse(rawHeader);
          if (p && p.nomorMc && p.nomorMc.toUpperCase() === appState.selectedMc.toUpperCase()) {
            if (p.operatorName && p.operatorName !== "-") {
              appState.selectedOperator = p.operatorName;
              needsFreshSnapshot = false;
            } else if (p.operatorId && resolveOperatorName) {
              const resolved = resolveOperatorName(p.operatorId, data);
              if (resolved) {
                appState.selectedOperator = resolved;
                p.operatorName = resolved;
                localStorage.setItem(KEYS.HEADER, JSON.stringify(p));
                needsFreshSnapshot = false;
              }
            }
          }
        }
      } catch (e) {}

      // Sinkronkan snapshot mesin aktif dari database
      syncSelectedMachineSnapshot(appState.selectedMc, needsFreshSnapshot);

      // Auto-assign default operator & group jika masih belum ada
      if (!appState.selectedOperator || appState.selectedOperator === "-") {
        const snap = data.snapshots && data.snapshots[appState.selectedMc.toUpperCase()];
        if (snap && snap.operatorName) {
          appState.selectedOperator = snap.operatorName;
          if (snap.groupId) appState.selectedGroup = snap.groupId;
        } else if (data.shiftInfo && data.operators) {
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
      }

      if (window.DJIHeaderModal && window.DJIHeaderModal.populateSelectors) {
        window.DJIHeaderModal.populateSelectors();
      }
      applyHeaderToCards();
      if (window.DJIState && window.DJIState.switchInputMode) {
        window.DJIState.switchInputMode(appState.currentMode);
      }

      // Pre-fetch live history for selected machine into cache in background
      if (window.DJIHistory && window.DJIHistory.fetchServerHistory) {
        window.DJIHistory.fetchServerHistory(true).catch(() => {});
      }

      // Cek antrean lokal: jika kosong dan server terhubung, tawari kembali ke portal utama
      const savedQ = getQueue();
      if (savedQ.length === 0) {
        notifyOnlineRestored();
      } else {
        trySyncQueueNow();
      }
    } catch (err) {
      console.log("Bootstrap live sync deferred:", err);
      updateNetworkStatusUI(false);
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
      const baseUrl = getApiBaseUrl ? getApiBaseUrl() : "";
      const res = await fetch(baseUrl + "/api/mobile/sync", {
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

          if (remainingQueue.length === 0) {
            notifyOnlineRestored();
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
    const btnSyncModal = document.getElementById("btnSyncQueueModal");
    if (!container) return;

    const queue = getQueue();
    if (badgeModal) {
      badgeModal.textContent = queue.length === 0 ? "0 antrean" : `${queue.length} antrean tertunda`;
      if (queue.length > 0) {
        badgeModal.classList.add("has-queue");
      } else {
        badgeModal.classList.remove("has-queue");
      }
    }

    if (btnSyncModal) {
      btnSyncModal.disabled = queue.length === 0;
      btnSyncModal.style.opacity = queue.length === 0 ? "0.5" : "1";
      btnSyncModal.style.cursor = queue.length === 0 ? "not-allowed" : "pointer";
    }

    if (queue.length === 0) {
      container.innerHTML = `
        <div class="queue-empty-box">
          <div class="queue-empty-icon-circle">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h4 class="queue-empty-title">Semua Data Telah Tersinkronisasi</h4>
          <p class="queue-empty-desc">Tidak ada antrean input offline yang tertunda di memori HP. Seluruh data produksi telah aman tersimpan di server pusat.</p>
          <div class="queue-empty-badge">
            <span class="status-online-dot"></span>
            <span>Memori Bersih &bull; Siap Real-Time</span>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    queue.forEach((item) => {
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
      const badgeKindClass = isStatus ? "mesin-mati" : (isIstirahat ? "istirahat" : "normal");

      card.innerHTML = `
        <div class="queue-card-top">
          <div class="queue-card-primary">
            <span class="queue-badge-mc">${item.nomorMc || 'MC'}</span>
            <div class="queue-title-wrapper">
              <span class="queue-card-unit ${isStatus ? 'status-stop' : ''}">${numLabel}</span>
              ${item.isPotongKain ? `<span class="queue-tag-potong">✂️ Potong Kain</span>` : ''}
              ${(item.isPanelBs || item.isBs || (item.panelNo && item.panelNo.includes('(BS)'))) ? `<span class="queue-tag-bs">⚠️ Panel BS</span>` : ''}
              ${(item.downtimeEvents && item.downtimeEvents.length > 0) ? `<span class="queue-tag-downtime">⏱️ ${item.downtimeEvents.length} Kendala</span>` : ''}
            </div>
          </div>
          <span class="queue-badge-kind ${badgeKindClass}">
            <span class="kind-dot"></span>
            <span>${badgeKindLabel}</span>
          </span>
        </div>

        <div class="queue-meta-grid">
          <div class="queue-meta-cell">
            <span class="queue-meta-label">POTONGAN</span>
            <span class="queue-meta-value">#${item.potonganKe || 1}</span>
          </div>
          <div class="queue-meta-cell">
            <span class="queue-meta-label">DESAIN</span>
            <span class="queue-meta-value" title="${item.designId || '-'}">${item.designId || '-'}</span>
          </div>
          <div class="queue-meta-cell queue-meta-operator">
            <span class="queue-meta-label">OPERATOR</span>
            <div class="queue-meta-op-wrap">
              <span class="queue-op-name" title="${item.operatorName || '-'}">${item.operatorName || '-'}</span>
              <span class="queue-op-shift">Shift ${item.groupId || 'A'}</span>
            </div>
          </div>
          <div class="queue-meta-cell">
            <span class="queue-meta-label">JAM INPUT</span>
            <span class="queue-meta-value">${timeStr} WIB</span>
          </div>
        </div>

        <div class="queue-card-bottom">
          <div class="queue-device-status">
            <span class="queue-ping-amber"></span>
            <span>Tersimpan di Memori HP</span>
          </div>
          <button type="button" class="btn-delete-queue-item" onclick="DJIApi.deleteQueueItem('${item.id}')" title="Hapus dari antrean lokal">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
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

  // Globals for inline onclick attributes in HTML
  window.returnToOnlinePortal = returnToOnlinePortal;
  window.stayInOfflineMode = stayInOfflineMode;
  window.handleNetworkPillClick = handleNetworkPillClick;

  window.DJIApi = {
    fetchLiveBootstrap,
    refreshQueueBadge,
    trySyncQueueNow,
    getQueue,
    deleteQueueItem,
    renderQueueList,
    openQueueModal,
    closeQueueModal,
    returnToOnlinePortal,
    stayInOfflineMode,
    handleNetworkPillClick,
    notifyOnlineRestored,
    dismissOnlineBanner
  };
})(window);
