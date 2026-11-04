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
    showToast,
    FALLBACK_OPERATORS
  } = window.DJIConfig;
  const { appState, syncSelectedMachineSnapshot, applyHeaderToCards, detectMachineMode, switchInputMode } = window.DJIState;
  const { fetchLiveBootstrap, refreshQueueBadge, trySyncQueueNow } = window.DJIApi;
  const { renderAntreanEvents, updateTotalDowntimeDisplay } = window.DJIDowntime;
  const { populateSelectors } = window.DJIHeaderModal;

  async function submitCurrentProduction(options = {}) {
    if (appState.reportKind === "ISTIRAHAT" && !appState.backupOperator) {
      alert("Wajib memilih Operator Backup yang menjaga mesin sebelum menyimpan laporan istirahat.");
      if (window.openBackupOperatorModal) window.openBackupOperatorModal();
      return;
    }

    const isMeter = appState.currentMode === "METER";
    const isCutOnly = Boolean(options.isCutOnly);
    const opDate = options.tanggalPotong || getOperationalDate();
    const opShift = getOperationalShift();
    const isIstirahat = appState.reportKind === "ISTIRAHAT";

    // Resolusi operatorId dan groupId yang valid
    const operatorId = resolveOperatorId(appState.selectedOperator, appState.bootstrap);
    const normGroup = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup);
    const groupId = normGroup === "B" ? "2" : normGroup === "C" ? "3" : "1";
    const nowIso = new Date().toISOString();
    const oldPotongan = parseInt(String(appState.selectedPotongan || 1), 10) || 1;

    // ── KASUS 1: POTONG KAIN MURNI (CUT-ONLY / TUTUP ROLL TANPA PANEL BARU) ──
    if (isCutOnly) {
      const submitData = {
        operatorId: String(operatorId),
        groupId: String(groupId),
        grupName: normGroup,
        nomorMc: appState.selectedMc,
        designId: String(appState.selectedDesign || "1"),
        statusMatching: appState.selectedMatching || "OK",
        potonganKe: String(oldPotongan),
        panelNo: null, // null is recognized as isCutOnlySubmit by backend
        isPanelGagal: false,
        jenisLaporan: "Potong Kain",
        tanggalPotong: opDate,
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
        totalDowntime: "0",
        downtimeEvents: [],
        pcsData: [],
        submittedAt: nowIso,
        idempotencyKey: "offline_cut_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
      };

      const payloadId = "offline_cut_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const payload = {
        id: payloadId,
        type: isMeter ? "continuous" : "employee",
        timestamp: nowIso,
        data: submitData,
        nomorMc: appState.selectedMc,
        operatorName: appState.selectedOperator,
        groupId: normGroup,
        shift: opShift.shiftNumber,
        operationalDate: opDate,
        potonganKe: oldPotongan,
        designId: appState.selectedDesign,
        panelNo: "POTONG KAIN",
        isCutOnly: true,
        isPotongKain: true,
        inputType: isMeter ? "METER" : "PANEL",
        jenisLaporan: "Potong Kain"
      };

      // 1. Simpan ke antrean localStorage
      let queue = [];
      try {
        const savedQ = localStorage.getItem(KEYS.QUEUE);
        if (savedQ) queue = JSON.parse(savedQ);
      } catch (e) {}
      queue.push(payload);
      localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));

      // 2. Simpan juga ke IndexedDB
      await savePendingToIDB({
        id: payload.id,
        type: payload.type,
        timestamp: payload.timestamp,
        data: submitData,
        retryCount: 0
      });

      // Transisi ke Potongan Baru
      const nextPotongan = oldPotongan + 1;
      appState.selectedPotongan = nextPotongan;
      appState.isPotongKain = false;
      appState.isPanelBs = false;
      appState.pcsBs = {};
      if (window.DJIHeaderModal && window.DJIHeaderModal.updateBsButtonUI) {
        window.DJIHeaderModal.updateBsButtonUI();
      }
      if (window.DJIState && window.DJIState.saveHeaderToStorage) {
        window.DJIState.saveHeaderToStorage();
      }
      if (window.DJIState && window.DJIState.applyHeaderToCards) {
        window.DJIState.applyHeaderToCards();
      }

      if (!isMeter) {
        const inpP = document.getElementById("inpPanelNo");
        if (inpP) inpP.value = "1";
        showToast('✂️ Potongan #' + oldPotongan + ' selesai dipotong! Memulai Potongan #' + nextPotongan + ' pada Panel #1.');
      } else {
        showToast('✂️ Potongan #' + oldPotongan + ' selesai dipotong! Memulai Potongan #' + nextPotongan + '.');
      }

      refreshQueueBadge();
      trySyncQueueNow();
      return;
    }

    // ── KASUS 2: LAPORAN NORMAL / PANEL DENGAN POTONG KAIN / PANEL BS ──
    const panelNo = document.getElementById("inpPanelNo")?.value || "1";

    if (!isMeter && (!panelNo || isNaN(parseInt(panelNo, 10)))) {
      alert("Nomor Panel harus diisi angka yang valid!");
      return;
    }

    // Terapkan opsi dari modal jika dikirimkan
    if (options.isPotongKain !== undefined) appState.isPotongKain = Boolean(options.isPotongKain);
    if (options.isBs !== undefined) appState.isPanelBs = Boolean(options.isBs);
    if (options.pcsBs) appState.pcsBs = options.pcsBs;

    const isBs = Boolean(appState.isPanelBs);
    let jenisLaporan = "NORMAL";
    if (isIstirahat) {
      jenisLaporan = 'Istirahat (Backup: ' + appState.backupOperator + ')';
    } else if (isBs) {
      jenisLaporan = "Panel BS";
    }

    const pcsCount = appState.pcsCount || (["R11", "R12", "R13", "R16"].includes((appState.selectedMc || "").toUpperCase()) ? 3 : ["T2", "T2A"].includes((appState.selectedMc || "").toUpperCase()) ? 2 : 1);
    const totalDowntimeSec = (appState.downtimeEvents || []).reduce((acc, ev) => acc + (ev.duration || ev.durasiDetik || 0), 0);
    const effectiveTanggalPotong = appState.isPotongKain ? (options.tanggalPotong || opDate) : null;

    let submitData = {};

    if (!isMeter) {
      const pcsData = [];
      for (let i = 1; i <= pcsCount; i++) {
        const thisPcsIsBs = appState.pcsBs && appState.pcsBs[i] !== undefined ? Boolean(appState.pcsBs[i]) : isBs;
        pcsData.push({
          pcsIndex: String(i),
          jmlHasilProduksi: thisPcsIsBs ? "0" : "1",
          isBs: thisPcsIsBs
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
        panelNo: String(panelNo),
        isPanelGagal: isBs,
        jenisLaporan: jenisLaporan,
        operatorBackup: isIstirahat ? appState.backupOperator : null,
        operatorBackup: isIstirahat ? appState.backupOperator : null,
        backupOperator: isIstirahat ? appState.backupOperator : null,
        tanggalPotong: effectiveTanggalPotong,
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
        downtimeEvents: (appState.downtimeEvents || []).map(evt => {
          const normPcs = Array.isArray(evt.pcsKe)
            ? (evt.pcsKe.length === 0 || evt.pcsKe.length === pcsCount ? "Semua" : evt.pcsKe.join(", "))
            : String(evt.pcsKe || (pcsCount > 1 ? "Semua" : "1"));
          return {
            ...evt,
            pcsKe: normPcs,
            problems: (evt.problems || []).map(p => ({
              ...p,
              pcsKe: Array.isArray(p.pcsKe)
                ? (p.pcsKe.length === 0 || p.pcsKe.length === pcsCount ? "Semua" : p.pcsKe.join(", "))
                : String(p.pcsKe || normPcs)
            }))
          };
        }),
        pcsData: pcsData,
        submittedAt: nowIso,
        idempotencyKey: "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
      };
    } else {
      const pcsData = [];
      for (let i = 1; i <= pcsCount; i++) {
        const thisPcsIsBs = appState.pcsBs && appState.pcsBs[i] !== undefined ? Boolean(appState.pcsBs[i]) : isBs;
        pcsData.push({
          pcsIndex: String(i),
          jmlHasilProduksi: thisPcsIsBs ? "0" : "1",
          meterKain: null,
          isBs: thisPcsIsBs
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
        panelNo: '1',
        isPanelGagal: isBs,
        meterAwal: null,
        meterAkhir: null,
        hasilProduksiMeter: null,
        jenisLaporan: jenisLaporan,
        backupOperator: isIstirahat ? appState.backupOperator : null,
        tanggalPotong: effectiveTanggalPotong,
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
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
      groupId: normGroup,
      shift: opShift.shiftNumber,
      operationalDate: opDate,
      potonganKe: appState.selectedPotongan,
      designId: appState.selectedDesign,
      panelNo: isMeter ? "1" : String(panelNo),
      meterAwal: null,
      meterAkhir: null,
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

    // 2. Simpan juga ke IndexedDB
    await savePendingToIDB({
      id: payload.id,
      type: payload.type,
      timestamp: payload.timestamp,
      data: submitData,
      retryCount: 0
    });

    const wasPotongKain = Boolean(appState.isPotongKain);

    // Reset opsi khusus panel & event downtime
    appState.isPotongKain = false;
    appState.isPanelBs = false;
    appState.pcsBs = {};
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
    if (window.DJIDowntime && window.DJIDowntime.restoreActiveTimerIfNeeded) window.DJIDowntime.restoreActiveTimerIfNeeded();
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
        showToast('✂️ Potongan #' + oldPotongan + ' selesai dipotong! Memulai Potongan #' + nextPotongan + ' pada Panel #1.');
      } else {
        const inpAwal = document.getElementById("inpMeterAwal");
        const inpAkhir = document.getElementById("inpMeterAkhir");
        if (inpAwal) inpAwal.value = "0";
        if (inpAkhir) inpAkhir.value = "";
        showToast('✂️ Potongan #' + oldPotongan + ' selesai dipotong! Memulai Potongan #' + nextPotongan + ' (Meter 0m).');
      }
    } else {
      if (!isMeter) {
        if (isBs) {
          showToast('⚠️ Panel BS (#' + panelNo + ') tersimpan! Nomor panel ditahan untuk panel pengganti.');
        } else {
          const nextNo = (parseInt(panelNo, 10) || 1) + 1;
          const inpP = document.getElementById("inpPanelNo");
          if (inpP) inpP.value = String(nextNo);
          showToast('✅ Data Panel #' + panelNo + ' tersimpan di memori perangkat.');
        }
      } else {
        showToast('✅ Laporan Titik Cacat tersimpan di memori perangkat.');
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
    switchInputMode(appState.currentMode);
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
      if (window.DJIHistory && window.DJIHistory.fetchServerHistory) {
        window.DJIHistory.fetchServerHistory(true).catch(() => {});
      }
    });

    // Pengecekan berkala (tiap 15 detik) untuk memastikan data tetap terkirim
    // meskipun event 'online' tidak terpemicu oleh browser throttling / devtools
    setInterval(() => {
      if (navigator.onLine) {
        trySyncQueueNow();
      }
    }, 15000);
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

  
  /* ── Meter Reporting Modal Functions (1:1 with Online ContinuousForm) ── */
  function showMeterCardInfo() {
    showToast("Gunakan tombol ini jika ingin istirahat, jika beres potongan atau shift kerja selesai.", "info");
  }

  function populateModalBackupOperators() {
    const sel = document.getElementById("selModalBackupOperator");
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Operator Backup --</option>';

    const opShift = typeof getOperationalShift === "function" ? getOperationalShift() : { shiftNumber: 1, shiftGroup: "A" };
    const shiftNum = String(opShift.shiftNumber);
    const normGroup = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup || "A");
    const currentOp = (appState.selectedOperator || "").trim();

    let allOps = [];
    if (appState.bootstrap && Array.isArray(appState.bootstrap.operators) && appState.bootstrap.operators.length > 0) {
      allOps = appState.bootstrap.operators;
    } else if (window.DJIConfig && Array.isArray(window.DJIConfig.FALLBACK_OPERATORS)) {
      allOps = window.DJIConfig.FALLBACK_OPERATORS;
    }

    // Filter operators from same shift group / shift number, excluding current operator
    const shiftOps = allOps.filter(
      op => (String(op.shift || "").toUpperCase() === normGroup.toUpperCase() || String(op.shift) === shiftNum) &&
            op.name.toLowerCase() !== currentOp.toLowerCase()
    );
    const otherOps = allOps.filter(
      op => String(op.shift || "").toUpperCase() !== normGroup.toUpperCase() &&
            String(op.shift) !== shiftNum &&
            op.name.toLowerCase() !== currentOp.toLowerCase()
    );

    const orderedOps = [...shiftOps, ...otherOps];

    // Check last saved backup operator for this shift
    let savedBackup = "";
    try {
      savedBackup = localStorage.getItem("dji_last_backup_operator_" + normGroup) || "";
    } catch (e) {}

    orderedOps.forEach(op => {
      const opt = document.createElement("option");
      opt.value = op.name;
      opt.textContent = op.name + " (Shift " + (op.shift || normGroup) + ")";
      if (savedBackup && op.name.toLowerCase() === savedBackup.toLowerCase()) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    if (savedBackup && sel.value !== savedBackup) {
      sel.value = savedBackup;
    }
  }

  function openMeterModal(initialType) {
    try {
      const badgeMc = document.getElementById("badgeModalMcCode");
      if (badgeMc) badgeMc.textContent = appState.selectedMc || "R11";

      const lblStart = document.getElementById("lblModalStartMeter");
      if (lblStart) lblStart.textContent = String(appState.lastMeter || 0);

      const inpFinish = document.getElementById("inpModalFinishMeter");
      if (inpFinish) {
        inpFinish.value = "";
      }

      const lblHasil = document.getElementById("lblModalHasilProduksi");
      if (lblHasil) lblHasil.textContent = "0";

      try {
        populateModalBackupOperators();
      } catch (errPop) {
        console.warn("[openMeterModal] populateModalBackupOperators warning:", errPop);
      }

      try {
        pickModalMeterType(initialType || "");
      } catch (errPick) {
        console.warn("[openMeterModal] pickModalMeterType warning:", errPick);
      }

      const modal = document.getElementById("modalLaporanMeter");
      if (modal) {
        modal.classList.add("show");
        modal.style.display = "flex";
        setTimeout(() => {
          if (inpFinish) inpFinish.focus();
        }, 150);
      }
    } catch (err) {
      console.error("[openMeterModal] Error:", err);
      const modal = document.getElementById("modalLaporanMeter");
      if (modal) {
        modal.classList.add("show");
        modal.style.display = "flex";
      }
    }
  }

  function closeMeterModal() {
    const modal = document.getElementById("modalLaporanMeter");
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
  }

  function calculateModalTotalMeter() {
    const inpFinish = document.getElementById("inpModalFinishMeter");
    const lblHasil = document.getElementById("lblModalHasilProduksi");
    if (!inpFinish || !lblHasil) return;

    const finish = parseFloat(inpFinish.value) || 0;
    const start = parseFloat(appState.lastMeter) || 0;
    const hasil = Math.max(0, finish - start);
    lblHasil.textContent = String(Math.round(hasil));
  }

  function pickModalMeterType(type) {
    appState.modalMeterJenis = type || "";

    const btnOper = document.getElementById("btnMeterTypeOper");
    const btnIstirahat = document.getElementById("btnMeterTypeIstirahat");
    const btnMasuk = document.getElementById("btnMeterTypeMasuk");
    const boxBackup = document.getElementById("boxModalBackupOperator");
    const lblBackup = document.getElementById("lblModalBackupShift");

    if (btnOper) btnOper.classList.remove("active");
    if (btnIstirahat) btnIstirahat.classList.remove("active");
    if (btnMasuk) btnMasuk.classList.remove("active");

    const opShift = typeof getOperationalShift === "function" ? getOperationalShift() : { shiftNumber: 1, shiftGroup: "A" };
    const shiftName = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup || "A");

    if (type === "Mulai Istirahat") {
      if (btnIstirahat) btnIstirahat.classList.add("active");
      if (boxBackup) boxBackup.style.display = "flex";
      if (lblBackup) lblBackup.textContent = "Siapa yang menjaga mesin (Backup) - Shift " + shiftName + "? *";
    } else if (type === "Selesai Istirahat") {
      if (btnMasuk) btnMasuk.classList.add("active");
      if (boxBackup) boxBackup.style.display = "flex";
      if (lblBackup) lblBackup.textContent = "Siapa yang menjaga mesin saat ditinggal Istirahat (Shift " + shiftName + ")? *";
    } else {
      if (btnOper) btnOper.classList.add("active");
      if (boxBackup) boxBackup.style.display = "none";
    }
  }

  async function submitMeterReportFromModal() {
    const finishStr = document.getElementById("inpModalFinishMeter")?.value;
    if (!finishStr || finishStr.trim() === "") {
      showToast("Masukkan angka finish meter terlebih dahulu!", "error");
      return;
    }

    const finish = parseFloat(finishStr);
    const start = parseFloat(appState.lastMeter) || 0;
    if (finish < start) {
      const proceed = confirm("Finish meter (" + finish + "m) lebih kecil dari Start meter (" + start + "m). Yakin counter mesin telah reset/rollover?");
      if (!proceed) return;
    }

        const jenis = appState.modalMeterJenis || "";
    let backupOp = null;
    if (jenis === "Mulai Istirahat" || jenis === "Selesai Istirahat") {
      backupOp = document.getElementById("selModalBackupOperator")?.value;
      if (!backupOp) {
        showToast("Pilih Operator Backup yang menjaga mesin!", "error");
        const selBackup = document.getElementById("selModalBackupOperator");
        if (selBackup) selBackup.focus();
        return;
      }
      appState.backupOperator = backupOp;
      try {
        const opShift = typeof getOperationalShift === "function" ? getOperationalShift() : { shiftGroup: "A" };
        const shiftToUse = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup || "A");
        localStorage.setItem("dji_last_backup_operator_" + shiftToUse, backupOp);
      } catch (e) {}
    }

    const totalHasil = Math.max(0, finish - start);
    const nowIso = new Date().toISOString();
    const opDate = getOperationalDate();
    const opShift = getOperationalShift();
    const normGroup = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup);
    const operatorId = resolveOperatorId(appState.selectedOperator, appState.bootstrap);
    const groupId = normGroup === "B" ? "2" : normGroup === "C" ? "3" : "1";

    const pcsCount = appState.currentPcs || 1;
    const pcsData = [];
    for (let i = 1; i <= pcsCount; i++) {
      pcsData.push({
        pcsIndex: String(i),
        jmlHasilProduksi: "1",
        meterKain: String(finish),
        isBs: false
      });
    }

    const idempotencyKey = "offline_m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const submitData = {
      operatorId: String(operatorId),
      groupId: String(groupId),
      grupName: normGroup,
      nomorMc: appState.selectedMc,
      designId: String(appState.selectedDesign || "1"),
      statusMatching: appState.selectedMatching || "OK",
      potonganKe: String(appState.selectedPotongan || 1),
      isPanelGagal: false,
      meterAwal: String(start),
      meterAkhir: String(finish),
      hasilProduksiMeter: String(totalHasil),
      jenisLaporan: jenis,
      operatorBackup: backupOp,
      backupOperator: backupOp,
      tanggalPotong: null,
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
      totalDowntime: "0",
      downtimeEvents: [],
      pcsData: pcsData,
      submittedAt: nowIso,
      idempotencyKey: idempotencyKey
    };

    const payloadId = "offline_m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const payload = {
      id: payloadId,
      type: "continuous",
      timestamp: nowIso,
      data: submitData,
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
      groupId: normGroup,
      shift: opShift.shiftNumber,
      operationalDate: opDate,
      potonganKe: appState.selectedPotongan,
      designId: appState.selectedDesign,
      panelNo: "1",
      meterAwal: start,
      meterAkhir: finish,
      inputType: "METER",
      jenisLaporan: jenis,
      operatorBackup: backupOp,
      isPotongKain: false
    };

    // 1. Simpan ke antrean localStorage
    let queue = [];
    try {
      const savedQ = localStorage.getItem(KEYS.QUEUE);
      if (savedQ) queue = JSON.parse(savedQ);
    } catch (e) {}
    queue.push(payload);
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));

    // 2. Simpan juga ke IndexedDB
    await savePendingToIDB({
      id: payload.id,
      type: payload.type,
      timestamp: payload.timestamp,
      data: submitData,
      retryCount: 0
    });

    // 3. Update local state & storage for lastMeter
    appState.lastMeter = finish;
    try {
      localStorage.setItem("dji_last_meter_" + appState.selectedMc, String(finish));
    } catch (e) {}

    closeMeterModal();
    showToast("Laporan meteran (" + finish + "m) tersimpan ke antrean offline!", "success");
    refreshQueueBadge();

    // 4. Sinkronkan otomatis jika online
    if (navigator.onLine) {
      trySyncQueueNow();
    }
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
  window.toggleModalPotongKain = () => window.DJIHeaderModal.toggleModalPotongKain();
  window.toggleModalPcsBs = (idx) => window.DJIHeaderModal.toggleModalPcsBs(idx);
  window.toggleAdvInfo = (t, e) => window.DJIHeaderModal.toggleAdvInfo(t, e);
  window.onModalCutOnlyToggle = () => window.DJIHeaderModal.onModalCutOnlyToggle();
  window.submitFromBsModal = () => window.DJIHeaderModal.submitFromBsModal();
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
  window.fetchLiveBootstrap = () => window.DJIApi.fetchLiveBootstrap();
  window.trySyncQueueNow = () => window.DJIApi.trySyncQueueNow();
  window.openQueueModal = () => window.DJIApi.openQueueModal();
  window.closeQueueModal = () => window.DJIApi.closeQueueModal();
  window.deleteQueueItem = (id) => window.DJIApi.deleteQueueItem(id);
  window.toggleDarkMode = toggleDarkMode;
  window.openTutorialModal = openTutorialModal;
  window.closeTutorialModal = closeTutorialModal;
  window.showToast = showToast;
  window.showMeterCardInfo = showMeterCardInfo;
  window.openMeterModal = openMeterModal;
  window.closeMeterModal = closeMeterModal;
  window.calculateModalTotalMeter = calculateModalTotalMeter;
  window.pickModalMeterType = pickModalMeterType;
  window.submitMeterReportFromModal = submitMeterReportFromModal;



  // Sinkronisasi otomatis 1:1 antar-tab (/input <-> offline.html)
  window.addEventListener("focus", () => {
    try {
      window.DJIState.loadInitialState();
      syncSelectedMachineSnapshot(appState.selectedMc);
      applyHeaderToCards();
      renderAntreanEvents();
      updateTotalDowntimeDisplay();
      refreshQueueBadge();
      if (window.DJIDowntime && window.DJIDowntime.restoreActiveTimerIfNeeded) {
        window.DJIDowntime.restoreActiveTimerIfNeeded();
      }
    } catch (e) {}
  });

  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (
      e.key.includes("downtime") ||
      e.key.includes("header") ||
      e.key.includes("draft") ||
      e.key.includes("queue") ||
      e.key.includes("block")
    ) {
      try {
        window.DJIState.loadInitialState();
        syncSelectedMachineSnapshot(appState.selectedMc);
        applyHeaderToCards();
        renderAntreanEvents();
        updateTotalDowntimeDisplay();
        refreshQueueBadge();
        if (window.DJIDowntime && window.DJIDowntime.restoreActiveTimerIfNeeded) {
          window.DJIDowntime.restoreActiveTimerIfNeeded();
        }
      } catch (err) {}
    }
  });

  // Auto-init on DOMContentLoaded
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initOfflineApp);
  } else {
    initOfflineApp();
  }
})(window);
