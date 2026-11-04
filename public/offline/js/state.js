/**
 * State Management
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const {
    KEYS,
    normalizeGroupLetter,
    getOperationalShift,
    resolveOperatorId,
    resolveOperatorName,
    FALLBACK_OPERATORS,
    isMeterMachine
  } = window.DJIConfig;

  const appState = {
    currentMode: "PANEL", // "PANEL" or "METER"
    reportKind: "NORMAL", // "NORMAL" or "ISTIRAHAT"
    backupOperator: "",
    selectedMc: "R1",
    selectedOperator: "",
    selectedGroup: "A",
    selectedPotongan: 1,
    selectedDesign: "1",
    selectedMatching: "OK",
    rpm: "",
    pick: "",
    course: "",
    noOrderBarang: "",
    noCustomer: "",
    jenisBenangDasar: "",
    liner: "",
    heavy: "",
    shadow: "",
    pinggiran: "",
    currentPcs: 1,
    pcsCount: 1,
    isPotongKain: false,
    isPanelBs: false,
    pcsBs: {},
    bootstrap: null,
    downtimeEvents: [],
    queue: [],
    lastMeter: 0,
    modalMeterJenis: ""
  };

  function loadInitialState() {
    // 1. Hydrate bootstrap cache
    try {
      const rawBoot = localStorage.getItem(KEYS.BOOTSTRAP);
      if (rawBoot) appState.bootstrap = JSON.parse(rawBoot);
    } catch (e) {
      console.error("Error reading bootstrap:", e);
    }

    // 2. Discover active Input Mode & Machine from all sync channels (Online Form -> Offline Portal)
    let targetMode = "";
    try {
      const explicitMode = localStorage.getItem(KEYS.LAST_MODE || "dji_last_input_mode");
      if (explicitMode === "METER" || explicitMode === "PANEL") {
        targetMode = explicitMode;
      }
    } catch (e) {}

    if (!targetMode) {
      try {
        const lastRoute = localStorage.getItem(KEYS.LAST_ROUTE || "last_input_route");
        if (lastRoute === "/input-meter") targetMode = "METER";
        else if (lastRoute === "/input") targetMode = "PANEL";
      } catch (e) {}
    }

    let panelDraft = null;
    let meterDraft = null;
    try {
      const rawDraft = localStorage.getItem(KEYS.DRAFT_PANEL || "dji_form_draft_panel");
      if (rawDraft) panelDraft = JSON.parse(rawDraft);
    } catch (e) {}
    try {
      const rawContDraft = localStorage.getItem(KEYS.DRAFT_METER || "dji_form_draft_continuous");
      if (rawContDraft) meterDraft = JSON.parse(rawContDraft);
    } catch (e) {}

    const pTime = panelDraft?.updatedAt || 0;
    const mTime = meterDraft?.updatedAt || 0;

    if (!targetMode) {
      if (mTime > pTime && meterDraft?.nomorMc) {
        targetMode = "METER";
      } else if (pTime > mTime && panelDraft?.nomorMc) {
        targetMode = "PANEL";
      }
    }

    const checkIsMeter = (mc) => isMeterMachine ? isMeterMachine(mc, appState.bootstrap) : (["R11", "R12", "R13", "R16", "T2A"].includes((mc || "").toUpperCase()) || (mc || "").toUpperCase().startsWith("T"));

    let detectedMc = "";
    // If targetMode is METER, prioritize meter draft machine
    if (targetMode === "METER") {
      if (meterDraft && meterDraft.nomorMc && checkIsMeter(meterDraft.nomorMc)) {
        detectedMc = meterDraft.nomorMc.trim().toUpperCase();
      }
    } else if (targetMode === "PANEL") {
      if (panelDraft && panelDraft.nomorMc && !checkIsMeter(panelDraft.nomorMc)) {
        detectedMc = panelDraft.nomorMc.trim().toUpperCase();
      }
    }

    // Check explicit last selected MC
    if (!detectedMc) {
      try {
        const lastMc = localStorage.getItem(KEYS.LAST_MC || "dji_last_selected_mc");
        if (lastMc && typeof lastMc === "string" && lastMc.trim()) {
          const mc = lastMc.trim().toUpperCase();
          if (!targetMode) {
            targetMode = checkIsMeter(mc) ? "METER" : "PANEL";
            detectedMc = mc;
          } else if (targetMode === "METER" && checkIsMeter(mc)) {
            detectedMc = mc;
          } else if (targetMode === "PANEL" && !checkIsMeter(mc)) {
            detectedMc = mc;
          }
        }
      } catch (e) {}
    }

    // Check saved header
    let rawHeaderParsed = null;
    try {
      const rawHeader = localStorage.getItem(KEYS.HEADER);
      if (rawHeader) {
        rawHeaderParsed = JSON.parse(rawHeader);
        if (rawHeaderParsed && rawHeaderParsed.nomorMc) {
          const mc = String(rawHeaderParsed.nomorMc).trim().toUpperCase();
          if (!targetMode) {
            targetMode = checkIsMeter(mc) ? "METER" : "PANEL";
            detectedMc = mc;
          } else if (!detectedMc) {
            if (targetMode === "METER" && checkIsMeter(mc)) {
              detectedMc = mc;
            } else if (targetMode === "PANEL" && !checkIsMeter(mc)) {
              detectedMc = mc;
            }
          }
        }
      }
    } catch (e) {
      console.error("Error reading header:", e);
    }

    if (!targetMode) targetMode = "PANEL";

    if (!detectedMc || (targetMode === "METER" && !checkIsMeter(detectedMc)) || (targetMode === "PANEL" && checkIsMeter(detectedMc))) {
      detectedMc = targetMode === "METER" ? "R11" : "R1";
      if (appState.bootstrap) {
        const candidateMachines = (appState.bootstrap.machines && appState.bootstrap.machines.map(m => m.nomorMc || m.nomor_mc)) || (appState.bootstrap.snapshots ? Object.keys(appState.bootstrap.snapshots) : []);
        const found = candidateMachines.find(mc => targetMode === "METER" ? checkIsMeter(mc) : !checkIsMeter(mc));
        if (found) detectedMc = found.toUpperCase();
      }
    }

    appState.currentMode = targetMode;
    appState.selectedMc = detectedMc;
    try {
      localStorage.setItem(KEYS.LAST_MODE || "dji_last_input_mode", targetMode);
      localStorage.setItem(KEYS.LAST_ROUTE || "last_input_route", targetMode === "METER" ? "/input-meter" : "/input");
      localStorage.setItem(KEYS.LAST_MC || "dji_last_selected_mc", detectedMc);
    } catch (e) {}

    // 3. Load header details ONLY if matching active machine
    let headerApplied = false;
    let explicitOpName = "";
    try {
      const savedOpName = localStorage.getItem(KEYS.ACTIVE_OPERATOR_NAME || "dji_active_operator_name");
      if (savedOpName && savedOpName.trim()) explicitOpName = savedOpName.trim();
      if (!explicitOpName) {
        const savedOpId = localStorage.getItem(KEYS.ACTIVE_OPERATOR_ID || "dji_active_operator_id");
        if (savedOpId && resolveOperatorName) explicitOpName = resolveOperatorName(savedOpId, appState.bootstrap);
      }
    } catch (e) {}

    if (rawHeaderParsed && rawHeaderParsed.nomorMc && rawHeaderParsed.nomorMc.toUpperCase() === appState.selectedMc.toUpperCase()) {
      const p = rawHeaderParsed;
      if (p.operatorName && p.operatorName !== "-") {
        appState.selectedOperator = p.operatorName;
      } else if (p.operatorId && resolveOperatorName) {
        const resolved = resolveOperatorName(p.operatorId, appState.bootstrap);
        if (resolved) appState.selectedOperator = resolved;
      }

      if (p.groupId) appState.selectedGroup = normalizeGroupLetter(p.groupId);
      if (p.potonganKe) appState.selectedPotongan = Number(p.potonganKe);
      if (p.designId) appState.selectedDesign = String(p.designId);
      if (p.statusMatching) appState.selectedMatching = p.statusMatching;
      if (p.rpm) appState.rpm = p.rpm;
      if (p.pick || p.pic) appState.pick = p.pick || p.pic;
      if (p.course) appState.course = p.course;
      if (p.noOrderBarang) appState.noOrderBarang = p.noOrderBarang;
      if (p.noCustomer) appState.noCustomer = p.noCustomer;
      if (p.jenisBenangDasar) appState.jenisBenangDasar = p.jenisBenangDasar;
      if (p.liner) appState.liner = p.liner;
      if (p.heavy) appState.heavy = p.heavy;
      if (p.shadow) appState.shadow = p.shadow;
      if (p.pinggiran) appState.pinggiran = p.pinggiran;
      headerApplied = true;
    }

    // Jika operator masih belum terisi dari header, gunakan explicit active operator
    if ((!appState.selectedOperator || appState.selectedOperator === "-") && explicitOpName) {
      appState.selectedOperator = explicitOpName;
    }

    if (!headerApplied) {
      // Fallback default from 07:10 cut-off shift
      const shift = getOperationalShift();
      appState.selectedGroup = shift.shiftGroup;
    }

    // Always normalize group letter
    appState.selectedGroup = normalizeGroupLetter(appState.selectedGroup || "A");

    // 3. Load user session
    try {
      const rawUser = localStorage.getItem(KEYS.USER);
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u.fullName) {
          const el = document.getElementById("txtLoggedUser");
          if (el) el.textContent = u.fullName.toUpperCase();
        }
      }
    } catch (e) {}

    // 4. Load saved downtime events
    try {
      const rawEvts = localStorage.getItem(KEYS.DOWNTIME);
      if (rawEvts) {
        appState.downtimeEvents = JSON.parse(rawEvts);
      }
    } catch (e) {}
  }

    /**
   * Menghitung Nomor Panel berikutnya secara akurat berdasarkan:
   * 1. Draft form aktif (dji_form_draft_panel)
   * 2. Cache riwayat potongan lokal (dji_hist_cache_MC)
   * 3. Antrean offline lokal (dji_offline_queue)
   * 4. Recent items snapshot server (hanya jika potongan sama)
   * 5. Snapshot server default (hanya jika potongan sama persis)
   */
  function resolveNextPanelNumber(mcCode, targetPotongan, snap) {
    const targetPotStr = String(targetPotongan || 1);
    const mcUpper = String(mcCode || "").toUpperCase();

    // 1. Cek draft form aktif
    try {
      const rawDraft = localStorage.getItem(KEYS.DRAFT_PANEL || "dji_form_draft_panel");
      if (rawDraft) {
        const pd = JSON.parse(rawDraft);
        if (pd && pd.nomorMc && pd.nomorMc.toUpperCase() === mcUpper) {
          if (String(pd.potonganKe) === targetPotStr && pd.panelNo) {
            const draftNum = parseInt(String(pd.panelNo).replace(/\D/g, ""), 10);
            if (!isNaN(draftNum) && draftNum > 0) return draftNum;
          }
        }
      }
    } catch (e) {}

    // 2. Cek cache riwayat potongan lokal (dji_hist_cache_MC)
    try {
      const rawHist = localStorage.getItem("dji_hist_cache_" + mcUpper);
      if (rawHist) {
        const histData = JSON.parse(rawHist);
        if (Array.isArray(histData)) {
          let maxHistPanel = 0;
          for (const item of histData) {
            if (String(item.potongan_ke || item.potonganKe) === targetPotStr) {
              const pNo = String(item.panel_no || item.panelNo || "");
              if (pNo && !pNo.includes("BS") && !pNo.includes("GAGAL") && pNo !== "METERAN") {
                const num = parseInt(pNo.replace(/\D/g, ""), 10);
                if (!isNaN(num) && num > maxHistPanel) maxHistPanel = num;
              }
            }
          }
          if (maxHistPanel > 0) {
            return maxHistPanel + 1;
          }
        }
      }
    } catch (e) {}

    // 3. Cek antrean offline lokal (dji_offline_queue)
    try {
      const rawQueue = localStorage.getItem(KEYS.QUEUE || "dji_offline_queue");
      if (rawQueue) {
        const queueData = JSON.parse(rawQueue);
        if (Array.isArray(queueData)) {
          let maxQueuePanel = 0;
          for (const item of queueData) {
            if (String(item.nomorMc || "").toUpperCase() === mcUpper && String(item.potonganKe) === targetPotStr) {
              const pNo = String(item.panelNo || "");
              if (pNo && !pNo.includes("BS") && !pNo.includes("GAGAL") && pNo !== "METERAN") {
                const num = parseInt(pNo.replace(/\D/g, ""), 10);
                if (!isNaN(num) && num > maxQueuePanel) maxQueuePanel = num;
              }
            }
          }
          if (maxQueuePanel > 0) {
            return maxQueuePanel + 1;
          }
        }
      }
    } catch (e) {}

    // 4. Cek recentItems di snapshot bootstrap (hanya jika potongannya cocok)
    if (snap && Array.isArray(snap.recentItems)) {
      let maxRecentPanel = 0;
      let hasMatchingRecent = false;
      for (const item of snap.recentItems) {
        if (String(item.potonganKe || item.potongan_ke) === targetPotStr) {
          hasMatchingRecent = true;
          const pNo = String(item.panelNo || item.panel_no || "");
          if (pNo && !pNo.includes("BS") && !pNo.includes("GAGAL") && pNo !== "METERAN") {
            const num = parseInt(pNo.replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > maxRecentPanel) maxRecentPanel = num;
          }
        }
      }
      if (hasMatchingRecent) {
        return maxRecentPanel > 0 ? maxRecentPanel + 1 : 1;
      }
    }

    // 5. Cek snapshot default (HANYA jika potongan snapshot sama persis dengan targetPotongan!)
    if (snap && String(snap.potonganKe) === targetPotStr && snap.nextPanelNo !== undefined && snap.nextPanelNo !== null) {
      return Number(snap.nextPanelNo);
    }

    // 6. Default potongan baru
    return 1;
  }

  async function refreshPotonganHistoryCache(mcCode, potongan) {
    if (!navigator.onLine) return;
    try {
      const baseUrl = typeof getApiBaseUrl === "function" ? getApiBaseUrl() : "";
      const url = baseUrl + "/api/mobile/history?nomorMc=" + encodeURIComponent(mcCode) + "&potonganKe=" + encodeURIComponent(potongan) + "&limit=50";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          let existing = [];
          try {
            const raw = localStorage.getItem("dji_hist_cache_" + mcCode.toUpperCase());
            if (raw) existing = JSON.parse(raw);
          } catch (e) {}
          const otherPots = existing.filter(x => String(x.potongan_ke || x.potonganKe) !== String(potongan));
          const merged = [...json.data, ...otherPots];
          try {
            localStorage.setItem("dji_hist_cache_" + mcCode.toUpperCase(), JSON.stringify(merged));
            localStorage.setItem("dji_hist_cache_" + mcCode.toUpperCase() + "_" + potongan, JSON.stringify(json.data));
          } catch (e) {}
          
          if (window.DJIHistory) {
            window.DJIHistory.lastFetchedData = json.data;
          }
          
          const inpP = document.getElementById("inpPanelNo");
          if (inpP) {
            const snap = (appState.bootstrap && appState.bootstrap.snapshots) ? appState.bootstrap.snapshots[mcCode.toUpperCase()] : null;
            inpP.value = String(resolveNextPanelNumber(mcCode, potongan, snap));
          }
        }
      }
    } catch (e) {}
  }

  function syncSelectedMachineSnapshot(mcCode, forceOverwrite = false) {
    if (!appState.bootstrap || !appState.bootstrap.snapshots) return;
    const snap = appState.bootstrap.snapshots[mcCode.toUpperCase()];
    if (!snap) return;

    let hasValidHeaderForMc = false;
    try {
      const raw = localStorage.getItem(KEYS.HEADER);
      if (raw) {
        const p = JSON.parse(raw);
        // Header hanya dianggap sah milik mesin ini jika nomorMc nya sama persis
        if (p && p.nomorMc && p.nomorMc.toUpperCase() === mcCode.toUpperCase()) {
          hasValidHeaderForMc = true;
        }
      }
    } catch (e) {}

    // Hanya sinkronkan parameter mesin jika forceOverwrite atau belum ada header untuk mesin ini
    const shouldSyncParams = forceOverwrite || !hasValidHeaderForMc;

    if (shouldSyncParams) {
      if (snap.potonganKe !== undefined && snap.potonganKe !== null) {
        const currentPot = Number(appState.selectedPotongan || 0);
        const snapPot = Number(snap.potonganKe);
        if (!hasValidHeaderForMc || snapPot >= currentPot) {
          appState.selectedPotongan = Math.max(currentPot, snapPot);
        }
      }
      if (snap.designId) {
        appState.selectedDesign = String(snap.designId);
      }
      if (snap.rpm !== undefined) appState.rpm = snap.rpm;
      if (snap.pick !== undefined) appState.pick = snap.pick;
      if (snap.course !== undefined) appState.course = snap.course;
      if (snap.noOrderBarang !== undefined) appState.noOrderBarang = snap.noOrderBarang;
      if (snap.noCustomer !== undefined) appState.noCustomer = snap.noCustomer;
      if (snap.jenisBenangDasar !== undefined) appState.jenisBenangDasar = snap.jenisBenangDasar;
      if (snap.liner !== undefined) appState.liner = snap.liner;
      if (snap.heavy !== undefined) appState.heavy = snap.heavy;
      if (snap.shadow !== undefined) appState.shadow = snap.shadow;
      if (snap.pinggiran !== undefined) appState.pinggiran = snap.pinggiran;
      if (snap.statusMatching) appState.selectedMatching = snap.statusMatching;

      // Operator HANYA diisi dari snapshot jika operator lokal BENAR-BENAR belum ada / kosong!
      if ((!appState.selectedOperator || appState.selectedOperator === "-") && snap.operatorName) {
        appState.selectedOperator = snap.operatorName;
      }
      if (snap.groupId && (!appState.selectedGroup || !hasValidHeaderForMc)) {
        appState.selectedGroup = normalizeGroupLetter(snap.groupId);
      }
    }

    // Pastikan operator terisi dari snapshot HANYA jika masih kosong atau "-"
    if ((!appState.selectedOperator || appState.selectedOperator === "-") && snap.operatorName) {
      appState.selectedOperator = snap.operatorName;
      if (snap.groupId) appState.selectedGroup = normalizeGroupLetter(snap.groupId);
    }

    appState.currentPcs = snap.defaultPcs || (["R11", "R12", "R13", "R16"].includes(mcCode.toUpperCase()) ? 3 : ["T2", "T2A"].includes(mcCode.toUpperCase()) ? 2 : 1);
    appState.pcsCount = appState.currentPcs;

    const inpP = document.getElementById("inpPanelNo");
    if (inpP) {
      inpP.value = String(resolveNextPanelNumber(mcCode, appState.selectedPotongan, snap));
    }
    refreshPotonganHistoryCache(mcCode, appState.selectedPotongan);
    if (snap.lastMeter !== undefined && snap.lastMeter !== null) {
      appState.lastMeter = parseFloat(snap.lastMeter) || 0;
    }
    const localLast = localStorage.getItem("dji_last_meter_" + mcCode);
    if (localLast !== null) {
      appState.lastMeter = parseFloat(localLast) || 0;
    }
  }

  function applyHeaderToCards() {
    // Find Design label
    let designLabel = appState.selectedDesign;
    if (appState.bootstrap && appState.bootstrap.designs) {
      const found = appState.bootstrap.designs.find(
        d => String(d.id) === String(appState.selectedDesign) || d.name === appState.selectedDesign
      );
      if (found) designLabel = found.name;
    }

    const normGroup = normalizeGroupLetter(appState.selectedGroup || "A");

    const elMc = document.getElementById("dispMcDesign");
    const elMatch = document.getElementById("dispMatching");
    const elOpLbl = document.getElementById("dispOperatorLabel");
    const elOpName = document.getElementById("dispOperatorName");
    const elPot = document.getElementById("dispPotonganKe");
    const elEsp = document.getElementById("dispEsp32McCode");

    if (elMc) elMc.textContent = `${appState.selectedMc} / ${designLabel || '-'}`;
    if (elMatch) elMatch.textContent = appState.selectedMatching || "OK";
    if (elOpLbl) elOpLbl.textContent = `OPERATOR (${normGroup})`;
    if (elOpName) elOpName.textContent = appState.selectedOperator || "-";
    if (elPot) elPot.textContent = String(appState.selectedPotongan || 1);
    if (elEsp) elEsp.textContent = `Mesin ${appState.selectedMc}`;
  }

  function detectMachineMode(mcCode) {
    const checkIsMeter = (mc) => isMeterMachine ? isMeterMachine(mc, appState.bootstrap) : (["R11", "R12", "R13", "R16", "T2A"].includes((mc || "").toUpperCase()) || (mc || "").toUpperCase().startsWith("T"));
    const isMeter = checkIsMeter(mcCode);
    switchInputMode(isMeter ? "METER" : "PANEL");
  }

  function switchInputMode(mode) {
    const checkIsMeter = (mc) => isMeterMachine ? isMeterMachine(mc, appState.bootstrap) : (["R11", "R12", "R13", "R16", "T2A"].includes((mc || "").toUpperCase()) || (mc || "").toUpperCase().startsWith("T"));
    const targetMode = mode === "METER" ? "METER" : "PANEL";
    appState.currentMode = targetMode;

    try {
      localStorage.setItem(KEYS.LAST_MODE || "dji_last_input_mode", targetMode);
      localStorage.setItem(KEYS.LAST_ROUTE || "last_input_route", targetMode === "METER" ? "/input-meter" : "/input");
    } catch (e) {}

    // Otomatis sesuaikan mesin aktif saat tab beralih jika jenisnya tidak cocok
    if (targetMode === "METER" && !checkIsMeter(appState.selectedMc)) {
      let meterMc = "R11";
      if (appState.bootstrap) {
        const candidateMachines = (appState.bootstrap.machines && appState.bootstrap.machines.map(m => m.nomorMc || m.nomor_mc)) || (appState.bootstrap.snapshots ? Object.keys(appState.bootstrap.snapshots) : []);
        const found = candidateMachines.find(mc => checkIsMeter(mc));
        if (found) meterMc = found.toUpperCase();
      }
      appState.selectedMc = meterMc;
      try {
        localStorage.setItem(KEYS.LAST_MC || "dji_last_selected_mc", meterMc);
      } catch (e) {}
      syncSelectedMachineSnapshot(meterMc, false);
      if (window.DJIHistory && window.DJIHistory.fetchServerHistory) {
        window.DJIHistory.fetchServerHistory(true).catch(() => {});
      }
      applyHeaderToCards();
      const mcSelect = document.getElementById("selModalMachine");
      if (mcSelect) mcSelect.value = meterMc;
    } else if (targetMode === "PANEL" && checkIsMeter(appState.selectedMc)) {
      let panelMc = "R1";
      if (appState.bootstrap) {
        const candidateMachines = (appState.bootstrap.machines && appState.bootstrap.machines.map(m => m.nomorMc || m.nomor_mc)) || (appState.bootstrap.snapshots ? Object.keys(appState.bootstrap.snapshots) : []);
        const found = candidateMachines.find(mc => !checkIsMeter(mc));
        if (found) panelMc = found.toUpperCase();
      }
      appState.selectedMc = panelMc;
      try {
        localStorage.setItem(KEYS.LAST_MC || "dji_last_selected_mc", panelMc);
      } catch (e) {}
      syncSelectedMachineSnapshot(panelMc, false);
      if (window.DJIHistory && window.DJIHistory.fetchServerHistory) {
        window.DJIHistory.fetchServerHistory(true).catch(() => {});
      }
      applyHeaderToCards();
      const mcSelect = document.getElementById("selModalMachine");
      if (mcSelect) mcSelect.value = panelMc;
    }

    const tabP = document.getElementById("tabModePanel");
    const tabM = document.getElementById("tabModeMeter");
    const pBox = document.getElementById("boxNomorPanelWrapper");
    const cardM = document.getElementById("cardPelaporanAkhirMeter");
    const title = document.getElementById("lblFormTitle");
    const desc = document.getElementById("lblFormDesc");
    const submitBtnTxt = document.getElementById("txtSubmitBtn");

    if (targetMode === "METER") {
      if (tabP) tabP.classList.remove("active");
      if (tabM) tabM.classList.add("active");
      if (pBox) pBox.style.display = "none";
      if (cardM) cardM.style.display = "flex";
      if (title) title.textContent = "Form Input Produksi (Meteran)";
      if (desc) desc.textContent = "Data Header akan otomatis tersimpan untuk roll/meteran berikutnya.";
      if (submitBtnTxt) submitBtnTxt.textContent = "Kirim Laporan Titik Cacat";
    } else {
      if (tabM) tabM.classList.remove("active");
      if (tabP) tabP.classList.add("active");
      if (cardM) cardM.style.display = "none";
      if (pBox) pBox.style.display = "grid";
      if (title) title.textContent = "Form Input Produksi";
      if (desc) desc.textContent = "Data Header akan otomatis tersimpan untuk panel berikutnya.";
      if (submitBtnTxt) submitBtnTxt.textContent = "Kirim Laporan Panel";
    }
  }

  function checkBreakTimeRange() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timeVal = currentHour + currentMin / 60;

    let isAllowed = false;
    let shiftName = "";
    let allowedRange = "";

    if (timeVal >= 7.166 && timeVal < 15.166) {
      shiftName = "Shift 1";
      allowedRange = "10:00 - 13:00";
      if (timeVal >= 10.0 && timeVal < 13.0) {
        isAllowed = true;
      }
    } else if (timeVal >= 15.166 && timeVal < 23.166) {
      shiftName = "Shift 2";
      allowedRange = "18:00 - 21:00";
      if (timeVal >= 18.0 && timeVal < 21.0) {
        isAllowed = true;
      }
    } else {
      shiftName = "Shift 3";
      allowedRange = "02:00 - 05:00";
      if (currentHour >= 2 && currentHour < 5) {
        isAllowed = true;
      }
    }

    const timeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
    return { isAllowed, shiftName, allowedRange, timeStr };
  }

  function pickReportKind(kind) {
    if (kind === "NORMAL") {
      appState.reportKind = "NORMAL";
      appState.backupOperator = "";
      updateIstirahatUI();
      return;
    }

    // Kind is ISTIRAHAT
    const chk = checkBreakTimeRange();
    if (!chk.isAllowed) {
      openBreakWarningModal(chk);
      return;
    }

    // Allowed -> Open backup operator selector
    openBackupOperatorModal();
  }

  function openBreakWarningModal(chk) {
    const modal = document.getElementById("modalBreakWarning");
    const elTime = document.getElementById("txtWarningCurrentTime");
    const elShiftLbl = document.getElementById("txtWarningShiftLabel");
    const elRange = document.getElementById("txtWarningAllowedRange");

    if (elTime) elTime.textContent = (chk?.timeStr || "--:--") + " WIB";
    if (elShiftLbl) elShiftLbl.textContent = `Jam Wajar ${chk?.shiftName || 'Shift'}:`;
    if (elRange) elRange.textContent = chk?.allowedRange || "10:00 - 13:00";

    if (modal) modal.classList.add("show");
  }

  function closeBreakWarningModal(confirmProceed) {
    const modal = document.getElementById("modalBreakWarning");
    if (modal) modal.classList.remove("show");

    if (confirmProceed) {
      openBackupOperatorModal();
    } else {
      appState.reportKind = "NORMAL";
      appState.backupOperator = "";
      updateIstirahatUI();
    }
  }

  function openBackupOperatorModal() {
    const modal = document.getElementById("modalBackupOperator");
    const listEl = document.getElementById("backupOperatorsList");
    const btnCancel = document.getElementById("btnCancelBackupModal");

    if (btnCancel) {
      btnCancel.textContent = appState.backupOperator ? "Tutup" : "Batal (Kembali ke Normal)";
    }

    if (listEl) {
      listEl.innerHTML = "";
      const currentOpName = appState.selectedOperator || "";
      const normGroup = normalizeGroupLetter(appState.selectedGroup || "A");

      let allOps = [];
      if (appState.bootstrap && appState.bootstrap.operators && appState.bootstrap.operators.length > 0) {
        allOps = appState.bootstrap.operators;
      }

      // Filter peer operators in the same shift, excluding self
      let peerOps = allOps.filter(o => (o.shift || "").toUpperCase() === normGroup && (o.name || o.nama_operator) !== currentOpName);

      // If no operators in same shift, fallback to other operators excluding self
      if (peerOps.length === 0) {
        peerOps = allOps.filter(o => (o.name || o.nama_operator) !== currentOpName);
      }

      if (peerOps.length === 0) {
        listEl.innerHTML = `<p style="font-size: 12px; color: #64748b; text-align: center; padding: 16px 0;">Tidak ada operator lain yang terdaftar di Shift ${normGroup}.</p>`;
      } else {
        peerOps.forEach(op => {
          const opName = op.name || op.nama_operator;
          const isSelected = appState.backupOperator === opName;

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `btn-backup-item ${isSelected ? 'active' : ''}`;
          btn.innerHTML = `
            <span>${opName}</span>
            ${op.shift ? `<span style="font-size: 10px; font-weight: 800; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px;">Shift ${op.shift}</span>` : ''}
          `;
          btn.onclick = () => selectBackupOperator(opName);
          listEl.appendChild(btn);
        });
      }
    }

    if (modal) modal.classList.add("show");
  }

  function selectBackupOperator(opName) {
    appState.backupOperator = opName;
    appState.reportKind = "ISTIRAHAT";

    const modal = document.getElementById("modalBackupOperator");
    if (modal) modal.classList.remove("show");

    updateIstirahatUI();
    window.DJIConfig.showToast(`Mode Istirahat aktif (Backup: ${opName})`);
  }

  function closeBackupOperatorModal() {
    const modal = document.getElementById("modalBackupOperator");
    if (modal) modal.classList.remove("show");

    if (!appState.backupOperator) {
      appState.reportKind = "NORMAL";
    }
    updateIstirahatUI();
  }

  function updateIstirahatUI() {
    const isIstirahat = appState.reportKind === "ISTIRAHAT";
    const btnN = document.getElementById("btnReportNormal");
    const btnI = document.getElementById("btnReportIstirahat");
    const badgeActive = document.getElementById("badgeModeIstirahatAktif");
    const badgeBtnName = document.getElementById("badgeBtnBackupName");
    const banner = document.getElementById("bannerOperatorBackup");
    const txtBackupName = document.getElementById("txtBackupOperatorName");

    if (btnN) {
      if (isIstirahat) btnN.classList.remove("active", "normal");
      else btnN.classList.add("active", "normal");
    }

    if (btnI) {
      if (isIstirahat) btnI.classList.add("active", "istirahat");
      else btnI.classList.remove("active", "istirahat");
    }

    if (badgeActive) {
      badgeActive.style.display = (isIstirahat && appState.backupOperator) ? "inline-flex" : "none";
    }

    if (badgeBtnName) {
      if (isIstirahat && appState.backupOperator) {
        badgeBtnName.textContent = appState.backupOperator;
        badgeBtnName.style.display = "inline-block";
      } else {
        badgeBtnName.textContent = "";
        badgeBtnName.style.display = "none";
      }
    }

    if (banner) {
      if (isIstirahat) {
        banner.style.display = "flex";
        if (txtBackupName) {
          if (appState.backupOperator) {
            txtBackupName.textContent = `👤 ${appState.backupOperator}`;
            txtBackupName.style.color = "#78350f";
          } else {
            txtBackupName.textContent = "⚠️ Belum Memilih Operator Backup";
            txtBackupName.style.color = "#dc2626";
          }
        }
      } else {
        banner.style.display = "none";
      }
    }
  }

  function saveHeaderToStorage() {
    const opId = (resolveOperatorId && appState.selectedOperator)
      ? resolveOperatorId(appState.selectedOperator, appState.bootstrap)
      : "";

    const headerObj = {
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
      operatorId: opId,
      groupId: appState.selectedGroup,
      potonganKe: appState.selectedPotongan,
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
    try {
      localStorage.setItem(KEYS.HEADER, JSON.stringify(headerObj));
      localStorage.setItem(KEYS.LAST_MC || "dji_last_selected_mc", appState.selectedMc);
      if (appState.selectedOperator && appState.selectedOperator !== "-") {
        localStorage.setItem(KEYS.ACTIVE_OPERATOR_NAME || "dji_active_operator_name", appState.selectedOperator);
        if (opId) localStorage.setItem(KEYS.ACTIVE_OPERATOR_ID || "dji_active_operator_id", String(opId));
      }

      // Update atau bersihkan draft form online agar tidak mengembalikan potongan lama!
      try {
        const rawPanelDraft = localStorage.getItem("dji_form_draft_panel");
        if (rawPanelDraft) {
          const pd = JSON.parse(rawPanelDraft);
          pd.potonganKe = String(appState.selectedPotongan);
          pd.nomorMc = appState.selectedMc;
          pd.panelNo = "1";
          pd.updatedAt = Date.now();
          localStorage.setItem("dji_form_draft_panel", JSON.stringify(pd));
        }
        const rawMeterDraft = localStorage.getItem("dji_form_draft_continuous");
        if (rawMeterDraft) {
          const md = JSON.parse(rawMeterDraft);
          md.potonganKe = String(appState.selectedPotongan);
          md.nomorMc = appState.selectedMc;
          md.updatedAt = Date.now();
          localStorage.setItem("dji_form_draft_continuous", JSON.stringify(md));
        }
      } catch (errDraft) {}

      // Dispatch event agar tab online langsung mengupdate potongan tanpa reload
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dji_header_changed", { detail: headerObj }));
      }
    } catch (e) {}
  }


  function getEffectivePcsCount() {
    const mc = (appState.selectedMc || "").toUpperCase();
    const snap = appState.bootstrap?.snapshots?.[mc];
    const snapPcs = snap?.defaultPcs || (snap?.pcs ? parseInt(snap.pcs, 10) : null);
    if (snapPcs && snapPcs > 0) return snapPcs;
    if (appState.currentPcs && appState.currentPcs > 1) return appState.currentPcs;
    if (appState.pcsCount && appState.pcsCount > 1) return appState.pcsCount;
    if (["R11", "R12", "R13", "R16"].includes(mc)) return 3;
    if (["T2", "T2A"].includes(mc)) return 2;
    return appState.currentPcs || appState.pcsCount || 1;
  }

  window.DJIState = {
    appState,
    loadInitialState,
    syncSelectedMachineSnapshot,
    applyHeaderToCards,
    detectMachineMode,
    switchInputMode,
    pickReportKind,
    checkBreakTimeRange,
    openBreakWarningModal,
    closeBreakWarningModal,
    openBackupOperatorModal,
    selectBackupOperator,
    closeBackupOperatorModal,
    updateIstirahatUI,
    saveHeaderToStorage,
    getEffectivePcsCount
  ,
    resolveNextPanelNumber,
    refreshPotonganHistoryCache
  };
})(window);
