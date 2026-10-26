/**
 * Main Application Entry Point & Production Submission
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const {
    KEYS,
    getOperationalDate,
    getOperationalShift,
    normalizeGroupLetter,
    resolveOperatorId,
    savePendingToIDB,
    showToast
  } = window.DJIConfig;
  const { appState, syncSelectedMachineSnapshot, applyHeaderToCards, detectMachineMode } = window.DJIState;
  const { fetchLiveBootstrap, refreshQueueBadge, trySyncQueueNow } = window.DJIApi;
  const { renderAntreanEvents, updateTotalDowntimeDisplay } = window.DJIDowntime;
  const { populateSelectors } = window.DJIHeaderModal;

  async function submitCurrentProduction() {
    if (appState.reportKind === "ISTIRAHAT" && !appState.backupOperator) {
      alert("Wajib memilih Operator Backup yang menjaga mesin sebelum menyimpan laporan istirahat.");
      if (window.openBackupOperatorModal) window.openBackupOperatorModal();
      return;
    }

    const isMeter = appState.currentMode === "METER";
    const panelNo = document.getElementById("inpPanelNo")?.value || "1";
    const meterAwal = document.getElementById("inpMeterAwal")?.value || "0";
    const meterAkhir = document.getElementById("inpMeterAkhir")?.value || "0";

    if (!isMeter && (!panelNo || isNaN(parseInt(panelNo, 10)))) {
      alert("Nomor Panel harus diisi angka yang valid!");
      return;
    }

    if (isMeter && (!meterAkhir || isNaN(parseFloat(meterAkhir)))) {
      alert("Meter Akhir harus diisi angka yang valid!");
      return;
    }

    const opDate = getOperationalDate();
    const opShift = getOperationalShift();
    const isIstirahat = appState.reportKind === "ISTIRAHAT";

    // Resolusi operatorId dan groupId yang valid
    const operatorId = resolveOperatorId(appState.selectedOperator, appState.bootstrap);
    const normGroup = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup);
    const groupId = normGroup === "B" ? "2" : normGroup === "C" ? "3" : "1";

    const isBs = Boolean(appState.isPanelBs);
    let jenisLaporan = "NORMAL";
    if (isIstirahat) {
      jenisLaporan = `Istirahat (Backup: ${appState.backupOperator})`;
    } else if (isBs) {
      jenisLaporan = "Panel BS";
    }

    const pcsCount = appState.pcsCount || 1;
    const nowIso = new Date().toISOString();
    const totalDowntimeSec = (appState.downtimeEvents || []).reduce((acc, ev) => acc + (ev.duration || ev.durasiDetik || 0), 0);

    let submitData = {};

    if (!isMeter) {
      const pcsData = [];
      for (let i = 1; i <= pcsCount; i++) {
        pcsData.push({
          pcsIndex: String(i),
          jmlHasilProduksi: isBs ? "0" : "1",
          isBs: isBs
        });
      }

      submitData = {
        operatorId: String(operatorId),
        groupId: String(groupId),
        grupName: normGroup,
        nomorMc: appState.selectedMc,
        designId: String(appState.selectedDesign || "1"),
        statusMatching: appState.selectedMatching || "OK",
        potonganKe: String(appState.selectedPotongan || 1),
        panelNo: isBs ? `${panelNo} (BS)` : String(panelNo),
        isPanelGagal: isBs,
        jenisLaporan: jenisLaporan,
        operatorBackup: isIstirahat ? appState.backupOperator : null,
        tanggalPotong: appState.isPotongKain ? opDate : null,
        rpm: appState.rpm ? String(appState.rpm) : null,
        pick: appState.pick ? String(appState.pick) : null,
        course: appState.course ? String(appState.course) : null,
        noOrderBarang: appState.noOrderBarang || null,
        noCustomer: appState.noCustomer || null,
        jenisBenangDasar: appState.jenisBenangDasar || null,
        liner: appState.liner || null,
        heavy: appState.heavy || null,
        shadow: appState.shadow || null,
        pinggiran: appState.pinggiran || null,
        totalDowntime: String(totalDowntimeSec),
        downtimeEvents: appState.downtimeEvents || [],
        pcsData: pcsData,
        submittedAt: nowIso,
        idempotencyKey: "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
      };
    } else {
      const mA = parseFloat(meterAwal) || 0;
      const mB = parseFloat(meterAkhir) || 0;
      const diff = mB - mA;
      const pcsData = [];
      for (let i = 1; i <= pcsCount; i++) {
        pcsData.push({
          pcsIndex: String(i),
          jmlHasilProduksi: isBs ? "0" : "1",
          meterKain: String(mB),
          isBs: isBs
        });
      }

      submitData = {
        operatorId: String(operatorId),
        groupId: String(groupId),
        grupName: normGroup,
        nomorMc: appState.selectedMc,
        designId: String(appState.selectedDesign || "1"),
        statusMatching: appState.selectedMatching || "OK",
        potonganKe: String(appState.selectedPotongan || 1),
        isPanelGagal: isBs,
        meterAwal: String(mA),
        meterAkhir: String(mB),
        hasilProduksiMeter: String(diff > 0 ? diff : 0),
        jenisLaporan: jenisLaporan,
        backupOperator: isIstirahat ? appState.backupOperator : null,
        rpm: appState.rpm ? String(appState.rpm) : null,
        pick: appState.pick ? String(appState.pick) : null,
        course: appState.course ? String(appState.course) : null,
        noOrderBarang: appState.noOrderBarang || null,
        noCustomer: appState.noCustomer || null,
        jenisBenangDasar: appState.jenisBenangDasar || null,
        liner: appState.liner || null,
        heavy: appState.heavy || null,
        shadow: appState.shadow || null,
        pinggiran: appState.pinggiran || null,
        totalDowntime: String(totalDowntimeSec),
        downtimeEvents: appState.downtimeEvents || [],
        pcsData: pcsData,
        submittedAt: nowIso,
        idempotencyKey: "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
      };
    }

    const payloadId = "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const payload = {
      id: payloadId,
      type: isMeter ? "continuous" : "employee",
      timestamp: nowIso,
      data: submitData,
      // Metadata fields for offline UI quick rendering
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
      groupId: normGroup,
      shift: opShift.shiftNumber,
      operationalDate: opDate,
      potonganKe: appState.selectedPotongan,
      designId: appState.selectedDesign,
      panelNo: isMeter ? "1" : String(panelNo),
      meterAwal: isMeter ? parseFloat(meterAwal) : null,
      meterAkhir: isMeter ? parseFloat(meterAkhir) : null,
      inputType: isMeter ? "METER" : "PANEL",
      jenisLaporan: jenisLaporan,
      operatorBackup: isIstirahat ? appState.backupOperator : null,
      isPotongKain: appState.isPotongKain,
      isPanelBs: appState.isPanelBs,
      downtimeEvents: appState.downtimeEvents || []
    };

    // 1. Simpan ke antrean localStorage
    let queue = [];
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      if (savedQ) queue = JSON.parse(savedQ);
    } catch (e) {}
    queue.push(payload);
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));

    // 2. Simpan juga ke IndexedDB dji_offline_db (syncable oleh OfflineSyncManager saat online)
    await savePendingToIDB({
      id: payload.id,
      type: payload.type,
      timestamp: payload.timestamp,
      data: submitData,
      retryCount: 0
    });

    const wasPotongKain = Boolean(appState.isPotongKain);
    const oldPotongan = parseInt(String(appState.selectedPotongan || 1), 10) || 1;

    // Reset opsi khusus panel & event downtime
    appState.isPotongKain = false;
    appState.isPanelBs = false;
    if (window.DJIHeaderModal && window.DJIHeaderModal.updateBsButtonUI) {
      window.DJIHeaderModal.updateBsButtonUI();
    }

    if (isIstirahat) {
      appState.reportKind = "NORMAL";
      appState.backupOperator = "";
      if (window.DJIState && window.DJIState.updateIstirahatUI) {
        window.DJIState.updateIstirahatUI();
      }
    }
    if (appState.downtimeEvents && appState.downtimeEvents.length > 0) {
      appState.downtimeEvents = [];
      localStorage.setItem(KEYS.DOWNTIME, JSON.stringify([]));
      updateTotalDowntimeDisplay();
      renderAntreanEvents();
    }

    // Alur transisi Potong Kain vs Panel biasa
    if (wasPotongKain) {
      const nextPotongan = oldPotongan + 1;
      appState.selectedPotongan = nextPotongan;
      if (window.DJIState && window.DJIState.saveHeaderToStorage) {
        window.DJIState.saveHeaderToStorage();
      }
      if (window.DJIState && window.DJIState.applyHeaderToCards) {
        window.DJIState.applyHeaderToCards();
      }

      if (!isMeter) {
        const inpP = document.getElementById("inpPanelNo");
        if (inpP) inpP.value = "1";
        showToast(`✂️ Potongan #${oldPotongan} selesai dipotong! Memulai Potongan #${nextPotongan} pada Panel #1.`);
      } else {
        const inpAwal = document.getElementById("inpMeterAwal");
        const inpAkhir = document.getElementById("inpMeterAkhir");
        if (inpAwal) inpAwal.value = "0";
        if (inpAkhir) inpAkhir.value = "";
        showToast(`✂️ Potongan #${oldPotongan} selesai dipotong! Memulai Potongan #${nextPotongan} (Meter 0m).`);
      }
    } else {
      if (!isMeter) {
        if (isBs) {
          // Panel BS ditahan untuk menenun panel pengganti
          showToast(`⚠️ Panel BS (#${panelNo}) tersimpan! Nomor panel ditahan untuk panel pengganti.`);
        } else {
          const nextNo = (parseInt(panelNo, 10) || 1) + 1;
          const inpP = document.getElementById("inpPanelNo");
          if (inpP) inpP.value = nextNo;
          showToast(`Panel #${panelNo} tersimpan offline! Lanjut Panel #${nextNo}.`);
        }
      } else {
        const inpAwal = document.getElementById("inpMeterAwal");
        const inpAkhir = document.getElementById("inpMeterAkhir");
        if (inpAwal) inpAwal.value = meterAkhir;
        if (inpAkhir) inpAkhir.value = "";
        showToast(`Data meter tersimpan offline!`);
      }
    }

    refreshQueueBadge();
    trySyncQueueNow();
  }

  async function initOfflineApp() {
    // 1. Hydrate state
    window.DJIState.loadInitialState();

    // 2. Setup UI from local state
    syncSelectedMachineSnapshot(appState.selectedMc);
    populateSelectors();
    applyHeaderToCards();
    detectMachineMode(appState.selectedMc);
    refreshQueueBadge();
    renderAntreanEvents();
    updateTotalDowntimeDisplay();
    if (window.DJIHeaderModal && window.DJIHeaderModal.updateBsButtonUI) window.DJIHeaderModal.updateBsButtonUI();
    if (window.DJIState && window.DJIState.updateIstirahatUI) window.DJIState.updateIstirahatUI();
    if (window.DJIBlockMesin) window.DJIBlockMesin.checkActiveBlock();

    // 3. Online fetch: retrieve live bootstrap directly from server DB
    await fetchLiveBootstrap();

    // 4. Initialize ESP32 Wi-Fi WebSocket & Wake Lock
    if (window.DJIEsp32) window.DJIEsp32.init();

    // 5. Dark Mode Initialization
    initDarkMode();

    // 6. Background listeners
    window.addEventListener("online", () => {
      trySyncQueueNow();
      fetchLiveBootstrap();
    });
  }

  function initDarkMode() {
    const savedTheme = localStorage.getItem("dji_offline_theme");
    const isDark = savedTheme === "dark";
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    updateThemeToggleUI(isDark);
  }

  function toggleDarkMode() {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("dji_offline_theme", isDark ? "dark" : "light");
    updateThemeToggleUI(isDark);
    showToast(isDark ? "🌙 Mode Malam diaktifkan" : "☀️ Mode Terang diaktifkan");
  }

  function updateThemeToggleUI(isDark) {
    const btn = document.getElementById("btnThemeToggle");
    const txt = document.getElementById("txtThemeToggle");
    const icon = document.getElementById("iconThemeToggle");
    if (!btn) return;

    if (isDark) {
      if (txt) txt.textContent = "Mode Terang";
      if (icon) {
        icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
        icon.setAttribute("stroke", "#f59e0b");
      }
    } else {
      if (txt) txt.textContent = "Mode Malam";
      if (icon) {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
        icon.setAttribute("stroke", "#4f46e5");
      }
    }
  }

  function openTutorialModal() {
    const modal = document.getElementById("modalTutorial");
    if (modal) modal.classList.add("show");
  }

  function closeTutorialModal() {
    const modal = document.getElementById("modalTutorial");
    if (modal) modal.classList.remove("show");
  }

  window.DJIApp = {
    init: initOfflineApp,
    submitCurrentProduction,
    toggleDarkMode,
    openTutorialModal,
    closeTutorialModal
  };

  // Expose convenient global delegates for HTML inline onclick handlers
  window.openHeaderModal = () => window.DJIHeaderModal.openHeaderModal();
  window.closeHeaderModal = () => window.DJIHeaderModal.closeHeaderModal();
  window.saveHeaderModal = () => window.DJIHeaderModal.saveHeaderModal();
  window.resetHeaderForm = () => window.DJIHeaderModal.resetHeaderForm();
  window.onModalGroupChange = () => window.DJIHeaderModal.onGroupChange();
  window.onModalMachineChange = () => window.DJIHeaderModal.onMachineChange();
  window.onSelectRecentPlan = (id) => window.DJIHeaderModal.onSelectRecentPlan(id);
  window.openBsModal = () => window.DJIHeaderModal.openBsModal();
  window.closeBsModal = () => window.DJIHeaderModal.closeBsModal();
  window.saveBsModal = () => window.DJIHeaderModal.saveBsModal();
  window.openHistoryDrawer = () => window.DJIHistory.openHistoryDrawer();
  window.closeHistoryDrawer = () => window.DJIHistory.closeHistoryDrawer();
  window.startDowntimeTimer = () => window.DJIDowntime.startDowntimeTimer();
  window.stopAndSaveDowntime = () => window.DJIDowntime.stopAndSaveDowntime();
  window.cancelDowntimeTimer = () => window.DJIDowntime.cancelDowntimeTimer();
  window.toggleSelectAllEvents = (chk) => window.DJIDowntime.toggleSelectAllEvents(chk);
  window.toggleSelectEvent = (id, chk) => window.DJIDowntime.toggleSelectEvent(id, chk);
  window.resolveEventGlitch = (id) => window.DJIDowntime.resolveEventGlitch(id);
  window.openClassifyModal = (id) => window.DJIDowntime.openClassifyModal(id);
  window.switchInputMode = (m) => window.DJIState.switchInputMode(m);
  window.pickReportKind = (k) => window.DJIState.pickReportKind(k);
  window.openBreakWarningModal = (chk) => window.DJIState.openBreakWarningModal(chk);
  window.closeBreakWarningModal = (c) => window.DJIState.closeBreakWarningModal(c);
  window.openBackupOperatorModal = () => window.DJIState.openBackupOperatorModal();
  window.closeBackupOperatorModal = () => window.DJIState.closeBackupOperatorModal();
  window.selectBackupOperator = (n) => window.DJIState.selectBackupOperator(n);
  window.submitCurrentProduction = submitCurrentProduction;
  window.trySyncQueueNow = () => window.DJIApi.trySyncQueueNow();
  window.openQueueModal = () => window.DJIApi.openQueueModal();
  window.closeQueueModal = () => window.DJIApi.closeQueueModal();
  window.deleteQueueItem = (id) => window.DJIApi.deleteQueueItem(id);
  window.toggleDarkMode = toggleDarkMode;
  window.openTutorialModal = openTutorialModal;
  window.closeTutorialModal = closeTutorialModal;
  window.showToast = showToast;

  // Auto-init on DOMContentLoaded
  window.addEventListener("DOMContentLoaded", initOfflineApp);
})(window);
