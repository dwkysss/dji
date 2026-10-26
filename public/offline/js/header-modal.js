/**
 * Header Modal & Advanced Options Management
 * Matches ProductionHeaderModal.tsx 1:1
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, normalizeGroupLetter, showToast } = window.DJIConfig;
  const { appState, syncSelectedMachineSnapshot, applyHeaderToCards, detectMachineMode, saveHeaderToStorage } = window.DJIState;

  function populateSelectors() {
    const mcSelect = document.getElementById("modalSelMc");
    const groupSelect = document.getElementById("modalSelGroup");
    const opSelect = document.getElementById("modalSelOperator");
    const recentSelect = document.getElementById("modalSelRecentPlans");
    const dlDesigns = document.getElementById("dlActiveDesigns");

    if (!mcSelect || !groupSelect || !opSelect || !recentSelect || !dlDesigns) return;

    mcSelect.innerHTML = "";
    opSelect.innerHTML = "";
    dlDesigns.innerHTML = "";
    recentSelect.innerHTML = `<option value="">-- Pilih Riwayat untuk Salin Potongan & Data Mesin --</option>`;

    // 1. Machines from live bootstrap DB or fallback
    let machines = [];
    if (appState.bootstrap && appState.bootstrap.machines && appState.bootstrap.machines.length > 0) {
      machines = appState.bootstrap.machines.map(m => m.nomorMc);
    } else if (appState.bootstrap && appState.bootstrap.snapshots) {
      machines = Object.keys(appState.bootstrap.snapshots);
    } else {
      machines = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "T1", "T2", "T2A", "T3"];
    }

    machines.forEach(mc => {
      const opt = document.createElement("option");
      opt.value = mc;
      opt.textContent = mc;
      if (mc.toUpperCase() === appState.selectedMc.toUpperCase()) opt.selected = true;
      mcSelect.appendChild(opt);
    });

    // 2. Group Shift & Operator filter
    const normGroup = normalizeGroupLetter(appState.selectedGroup);
    groupSelect.value = normGroup;
    const opLbl = document.getElementById("lblModalOperatorShift");
    if (opLbl) opLbl.textContent = `Nama Operator (Shift ${normGroup}) *`;

    let allOperators = [];
    if (appState.bootstrap && appState.bootstrap.operators && appState.bootstrap.operators.length > 0) {
      allOperators = appState.bootstrap.operators;
    }

    const currentGrp = normGroup;
    const shiftOps = allOperators.filter(o => (o.shift || "").toUpperCase() === currentGrp.toUpperCase());
    const otherOps = allOperators.filter(o => (o.shift || "").toUpperCase() !== currentGrp.toUpperCase());
    const orderedOps = [...shiftOps, ...otherOps];

    orderedOps.forEach(op => {
      const opt = document.createElement("option");
      opt.value = op.name;
      opt.textContent = `${op.name} (Shift ${op.shift || 'A'})`;
      if (appState.selectedOperator && op.name.toLowerCase() === appState.selectedOperator.toLowerCase()) {
        opt.selected = true;
      }
      opSelect.appendChild(opt);
    });

    // 3. Active designs datalist
    let designs = (appState.bootstrap && appState.bootstrap.designs) ? appState.bootstrap.designs : [];
    designs.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.name;
      dlDesigns.appendChild(opt);
    });

    // 4. Recent plans for selected machine
    const snap = (appState.bootstrap && appState.bootstrap.snapshots) ? appState.bootstrap.snapshots[appState.selectedMc.toUpperCase()] : null;
    const plans = snap?.recentPlans || [];
    const mcCodeLbl = document.getElementById("lblRecentMcCode");
    const countBadge = document.getElementById("badgeRecentCount");
    if (mcCodeLbl) mcCodeLbl.textContent = appState.selectedMc;
    if (countBadge) countBadge.textContent = `${plans.length} riwayat ditemukan`;

    plans.forEach((p, idx) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${idx === 0 ? "★ [Terakhir] " : ""}Potongan #${p.potongan_ke} | Design: ${p.design_id || "-"} | Order: ${p.no_order_barang || "-"} | RPM: ${p.rpm || "-"}`;
      recentSelect.appendChild(opt);
    });

    // 5. Update Target Jumlah PCS
    const pcsEl = document.getElementById("dispModalPcsCount");
    if (pcsEl) pcsEl.textContent = String(appState.currentPcs || 1);

    // 6. Set input field values
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : "";
    };

    setVal("modalInpPotongan", appState.selectedPotongan || 1);
    setVal("modalInpDesign", appState.selectedDesign || "");
    setVal("modalSelMatching", appState.selectedMatching || "OK");
    setVal("modalInpRpm", appState.rpm || "");
    setVal("modalInpPick", appState.pick || "");
    setVal("modalInpCourse", appState.course || "");
    setVal("modalInpOrder", appState.noOrderBarang || "");
    setVal("modalInpCustomer", appState.noCustomer || "");
    setVal("modalInpBenangDasar", appState.jenisBenangDasar || "");
    setVal("modalInpLiner", appState.liner || "");
    setVal("modalInpHeavy", appState.heavy || "");
    setVal("modalInpShadow", appState.shadow || "");
    setVal("modalInpPinggiran", appState.pinggiran || "");
  }

  function onGroupChange() {
    const grp = normalizeGroupLetter(document.getElementById("modalSelGroup").value);
    appState.selectedGroup = grp;
    const opLbl = document.getElementById("lblModalOperatorShift");
    if (opLbl) opLbl.textContent = `Nama Operator (Shift ${grp}) *`;

    const opSelect = document.getElementById("modalSelOperator");
    if (!opSelect) return;
    opSelect.innerHTML = `<option value="">-- Pilih Operator --</option>`;

    const allOperators = (appState.bootstrap && appState.bootstrap.operators) ? appState.bootstrap.operators : [];
    const shiftOps = allOperators.filter(o => (o.shift || "").toUpperCase() === grp.toUpperCase());
    const otherOps = allOperators.filter(o => (o.shift || "").toUpperCase() !== grp.toUpperCase());

    [...shiftOps, ...otherOps].forEach(op => {
      const opt = document.createElement("option");
      opt.value = op.name;
      opt.textContent = `${op.name} (Shift ${op.shift || 'A'})`;
      opSelect.appendChild(opt);
    });

    if (shiftOps.length > 0) {
      opSelect.value = shiftOps[0].name;
    }
  }

  function onMachineChange() {
    const chosenMc = document.getElementById("modalSelMc").value;
    const mcCodeLbl = document.getElementById("lblRecentMcCode");
    if (mcCodeLbl) mcCodeLbl.textContent = chosenMc;

    const snap = (appState.bootstrap && appState.bootstrap.snapshots) ? appState.bootstrap.snapshots[chosenMc.toUpperCase()] : null;
    const plans = snap?.recentPlans || [];
    const countBadge = document.getElementById("badgeRecentCount");
    if (countBadge) countBadge.textContent = `${plans.length} riwayat ditemukan`;

    const recentSelect = document.getElementById("modalSelRecentPlans");
    if (recentSelect) {
      recentSelect.innerHTML = `<option value="">-- Pilih Riwayat untuk Salin Potongan & Data Mesin --</option>`;
      plans.forEach((p, idx) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${idx === 0 ? "★ [Terakhir] " : ""}Potongan #${p.potongan_ke} | Design: ${p.design_id || "-"} | Order: ${p.no_order_barang || "-"} | RPM: ${p.rpm || "-"}`;
        recentSelect.appendChild(opt);
      });
    }

    const pcs = snap?.defaultPcs || (["R11", "R12", "R16"].includes(chosenMc.toUpperCase()) ? 3 : ["T2", "T2A"].includes(chosenMc.toUpperCase()) ? 2 : 1);
    const pcsEl = document.getElementById("dispModalPcsCount");
    if (pcsEl) pcsEl.textContent = String(pcs);

    if (snap) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
      };
      setVal("modalInpPotongan", snap.potonganKe);
      setVal("modalInpDesign", snap.designId);
      setVal("modalInpRpm", snap.rpm);
      setVal("modalInpPick", snap.pick);
      setVal("modalInpCourse", snap.course);
      setVal("modalInpOrder", snap.noOrderBarang);
      setVal("modalInpCustomer", snap.noCustomer);
      setVal("modalInpBenangDasar", snap.jenisBenangDasar);
      setVal("modalInpLiner", snap.liner);
      setVal("modalInpHeavy", snap.heavy);
      setVal("modalInpShadow", snap.shadow);
      setVal("modalInpPinggiran", snap.pinggiran);
      setVal("modalSelMatching", snap.statusMatching);
    }
  }

  function onSelectRecentPlan(planId) {
    if (!planId) return;
    const chosenMc = document.getElementById("modalSelMc").value;
    const snap = (appState.bootstrap && appState.bootstrap.snapshots) ? appState.bootstrap.snapshots[chosenMc.toUpperCase()] : null;
    const plan = (snap?.recentPlans || []).find(p => p.id === planId);
    if (plan) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };
      setVal("modalInpPotongan", plan.potongan_ke);
      setVal("modalInpDesign", plan.design_id);
      setVal("modalInpRpm", plan.rpm);
      setVal("modalInpPick", plan.pick);
      setVal("modalInpCourse", plan.course);
      setVal("modalInpOrder", plan.no_order_barang);
      setVal("modalInpCustomer", plan.no_customer);
      setVal("modalInpBenangDasar", plan.jenis_benang_dasar);
      setVal("modalInpLiner", plan.liner);
      setVal("modalInpHeavy", plan.heavy);
      setVal("modalInpShadow", plan.shadow);
      setVal("modalInpPinggiran", plan.pinggiran);
      setVal("modalSelMatching", plan.status_matching);
      showToast(`Data spesifikasi & Potongan #${plan.potongan_ke} (${plan.design_id || "-"}) berhasil disalin.`);
    }
  }

  function openHeaderModal() {
    populateSelectors();
    const modal = document.getElementById("modalHeader");
    if (modal) modal.classList.add("show");
  }

  function closeHeaderModal() {
    const modal = document.getElementById("modalHeader");
    if (modal) modal.classList.remove("show");
  }

  function saveHeaderModal() {
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    appState.selectedMc = getVal("modalSelMc");
    appState.selectedOperator = getVal("modalSelOperator");
    appState.selectedGroup = getVal("modalSelGroup");
    appState.selectedPotongan = parseInt(getVal("modalInpPotongan"), 10) || 1;
    appState.selectedDesign = (getVal("modalInpDesign") || "1").trim().toUpperCase();
    appState.selectedMatching = getVal("modalSelMatching");
    appState.rpm = getVal("modalInpRpm");
    appState.pick = getVal("modalInpPick");
    appState.course = getVal("modalInpCourse");
    appState.noOrderBarang = getVal("modalInpOrder");
    appState.noCustomer = getVal("modalInpCustomer");
    appState.jenisBenangDasar = getVal("modalInpBenangDasar");
    appState.liner = getVal("modalInpLiner");
    appState.heavy = getVal("modalInpHeavy");
    appState.shadow = getVal("modalInpShadow");
    appState.pinggiran = getVal("modalInpPinggiran");

    saveHeaderToStorage();
    applyHeaderToCards();
    detectMachineMode(appState.selectedMc);
    if (window.DJIBlockMesin) window.DJIBlockMesin.checkActiveBlock();
    if (window.DJIEsp32) window.DJIEsp32.updateCardUI();
    closeHeaderModal();
    showToast("Header produksi berhasil disimpan.");
  }

  function resetHeaderForm() {
    localStorage.removeItem(KEYS.HEADER);
    appState.selectedOperator = "";
    syncSelectedMachineSnapshot(appState.selectedMc);
    populateSelectors();
    applyHeaderToCards();
    if (window.DJIBlockMesin) window.DJIBlockMesin.checkActiveBlock();
    if (window.DJIEsp32) window.DJIEsp32.updateCardUI();
    showToast("Header berhasil direset.");
  }

  /* ── BS / Opsi Lanjutan Modal ── */
  function updateBsButtonUI() {
    const btn = document.getElementById("btnPotongKainBs");
    const txt = document.getElementById("txtBtnPotongKainBs");
    if (!btn || !txt) return;

    const badges = [];
    if (appState.isPotongKain) {
      badges.push(`<span class="badge-opt-pill potong">✂️ Potong Kain</span>`);
    }
    if (appState.isPanelBs) {
      badges.push(`<span class="badge-opt-pill bs">⚠️ Panel BS</span>`);
    }

    if (badges.length > 0) {
      btn.classList.add("active-opts");
      txt.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;">${badges.join(" ")} <span style="font-size:11px; opacity:0.8;">(Klik untuk ubah)</span></span>`;
    } else {
      btn.classList.remove("active-opts");
      txt.textContent = "Potong Kain & BS";
    }
  }

  function openBsModal() {
    const chkPot = document.getElementById("chkModalPotongKain");
    const chkPanelBs = document.getElementById("chkModalPanelBs");
    if (chkPot) chkPot.checked = Boolean(appState.isPotongKain);
    if (chkPanelBs) chkPanelBs.checked = Boolean(appState.isPanelBs);

    const modal = document.getElementById("modalBs");
    if (modal) modal.classList.add("show");
  }

  function closeBsModal() {
    const modal = document.getElementById("modalBs");
    if (modal) modal.classList.remove("show");
  }

  function saveBsModal() {
    const chkPot = document.getElementById("chkModalPotongKain");
    const chkPanelBs = document.getElementById("chkModalPanelBs");

    if (chkPot) appState.isPotongKain = chkPot.checked;
    if (chkPanelBs) appState.isPanelBs = chkPanelBs.checked;

    closeBsModal();
    updateBsButtonUI();

    let msg = "Opsi lanjutan diperbarui.";
    if (appState.isPotongKain && appState.isPanelBs) {
      msg = "✂️ Potong Kain & ⚠️ Panel BS aktif.";
    } else if (appState.isPotongKain) {
      msg = "✂️ Potong Kain ditandai selesai (Akan lanjut ke potongan berikutnya setelah kirim).";
    } else if (appState.isPanelBs) {
      msg = "⚠️ Panel ditandai BS (Nomor panel akan ditahan untuk panel pengganti).";
    }
    showToast(msg);
  }

  window.DJIHeaderModal = {
    openHeaderModal,
    closeHeaderModal,
    saveHeaderModal,
    resetHeaderForm,
    populateSelectors,
    onGroupChange,
    onMachineChange,
    onSelectRecentPlan,
    openBsModal,
    closeBsModal,
    saveBsModal,
    updateBsButtonUI
  };
})(window);
