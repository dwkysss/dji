/**
 * State Management
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, normalizeGroupLetter, getOperationalShift } = window.DJIConfig;

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
    isPotongKain: false,
    isPanelBs: false,
    bootstrap: null,
    downtimeEvents: [],
    queue: []
  };

  function loadInitialState() {
    // 1. Hydrate bootstrap cache
    try {
      const rawBoot = localStorage.getItem(KEYS.BOOTSTRAP);
      if (rawBoot) appState.bootstrap = JSON.parse(rawBoot);
    } catch (e) {
      console.error("Error reading bootstrap:", e);
    }

    // 2. Load cached header
    try {
      const rawHeader = localStorage.getItem(KEYS.HEADER);
      if (rawHeader) {
        const p = JSON.parse(rawHeader);
        if (p.nomorMc) appState.selectedMc = p.nomorMc;
        if (p.operatorName) appState.selectedOperator = p.operatorName;
        if (p.groupId) appState.selectedGroup = p.groupId;
        if (p.potonganKe) appState.selectedPotongan = Number(p.potonganKe);
        if (p.designId) appState.selectedDesign = String(p.designId);
        if (p.statusMatching) appState.selectedMatching = p.statusMatching;
        if (p.rpm) appState.rpm = p.rpm;
        if (p.pick) appState.pick = p.pick;
        if (p.course) appState.course = p.course;
        if (p.noOrderBarang) appState.noOrderBarang = p.noOrderBarang;
        if (p.noCustomer) appState.noCustomer = p.noCustomer;
        if (p.jenisBenangDasar) appState.jenisBenangDasar = p.jenisBenangDasar;
        if (p.liner) appState.liner = p.liner;
        if (p.heavy) appState.heavy = p.heavy;
        if (p.shadow) appState.shadow = p.shadow;
        if (p.pinggiran) appState.pinggiran = p.pinggiran;
      } else {
        // Fallback default from 07:10 cut-off shift
        const shift = getOperationalShift();
        appState.selectedGroup = shift.shiftGroup;
      }
    } catch (e) {
      console.error("Error reading header:", e);
    }

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

  function syncSelectedMachineSnapshot(mcCode) {
    if (!appState.bootstrap || !appState.bootstrap.snapshots) return;
    const snap = appState.bootstrap.snapshots[mcCode.toUpperCase()];
    if (!snap) return;

    const hasCustomHeader = Boolean(localStorage.getItem(KEYS.HEADER));
    if (!hasCustomHeader) {
      if (snap.potonganKe !== undefined && snap.potonganKe !== null) {
        appState.selectedPotongan = Number(snap.potonganKe);
      }
      if (snap.designId) {
        appState.selectedDesign = String(snap.designId);
      }
      if (snap.rpm) appState.rpm = snap.rpm;
      if (snap.pick) appState.pick = snap.pick;
      if (snap.course) appState.course = snap.course;
      if (snap.noOrderBarang) appState.noOrderBarang = snap.noOrderBarang;
      if (snap.noCustomer) appState.noCustomer = snap.noCustomer;
      if (snap.jenisBenangDasar) appState.jenisBenangDasar = snap.jenisBenangDasar;
      if (snap.liner) appState.liner = snap.liner;
      if (snap.heavy) appState.heavy = snap.heavy;
      if (snap.shadow) appState.shadow = snap.shadow;
      if (snap.pinggiran) appState.pinggiran = snap.pinggiran;
      if (snap.statusMatching) appState.selectedMatching = snap.statusMatching;
    }

    appState.currentPcs = snap.defaultPcs || (["R11", "R12", "R16"].includes(mcCode.toUpperCase()) ? 3 : ["T2", "T2A"].includes(mcCode.toUpperCase()) ? 2 : 1);

    if (snap.nextPanelNo) {
      const inpP = document.getElementById("inpPanelNo");
      if (inpP) inpP.value = snap.nextPanelNo;
    }
    if (snap.lastMeter !== undefined) {
      const inpM = document.getElementById("inpMeterAwal");
      if (inpM) inpM.value = snap.lastMeter;
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

    const elMc = document.getElementById("dispMcDesign");
    const elMatch = document.getElementById("dispMatching");
    const elOpLbl = document.getElementById("dispOperatorLabel");
    const elOpName = document.getElementById("dispOperatorName");
    const elPot = document.getElementById("dispPotonganKe");
    const elEsp = document.getElementById("dispEsp32McCode");

    if (elMc) elMc.textContent = `${appState.selectedMc} / ${designLabel || '-'}`;
    if (elMatch) elMatch.textContent = appState.selectedMatching || "OK";
    if (elOpLbl) elOpLbl.textContent = `OPERATOR (${appState.selectedGroup || 'A'})`;
    if (elOpName) elOpName.textContent = appState.selectedOperator || "-";
    if (elPot) elPot.textContent = String(appState.selectedPotongan || 1);
    if (elEsp) elEsp.textContent = `Mesin ${appState.selectedMc}`;
  }

  function detectMachineMode(mcCode) {
    const code = (mcCode || "").toUpperCase();
    const isMeter = ["R11", "R12", "R16", "T2A"].includes(code);
    switchInputMode(isMeter ? "METER" : "PANEL");
  }

  function switchInputMode(mode) {
    appState.currentMode = mode;
    const tabP = document.getElementById("tabModePanel");
    const tabM = document.getElementById("tabModeMeter");
    const pBox = document.getElementById("boxNomorPanelWrapper");
    const mBox = document.getElementById("boxMeterInputsWrapper");
    const title = document.getElementById("lblFormTitle");
    const desc = document.getElementById("lblFormDesc");
    const submitBtnTxt = document.getElementById("txtSubmitBtn");

    if (mode === "METER") {
      if (tabP) tabP.classList.remove("active");
      if (tabM) tabM.classList.add("active");
      if (pBox) pBox.style.display = "none";
      if (mBox) mBox.style.display = "flex";
      if (title) title.textContent = "Form Input Produksi (Meteran)";
      if (desc) desc.textContent = "Data Header akan otomatis tersimpan untuk roll/meteran berikutnya.";
      if (submitBtnTxt) submitBtnTxt.textContent = "Kirim Laporan Titik Cacat";
    } else {
      if (tabM) tabM.classList.remove("active");
      if (tabP) tabP.classList.add("active");
      if (mBox) mBox.style.display = "none";
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
    const headerObj = {
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
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
      pinggiran: appState.pinggiran
    };
    localStorage.setItem(KEYS.HEADER, JSON.stringify(headerObj));
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
    saveHeaderToStorage
  };
})(window);
