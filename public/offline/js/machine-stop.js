/**
 * Lapor Mesin Mati (Machine Stop Report)
 * Matches MachineStopModal.tsx 1:1
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, PROBLEM_CATEGORIES, GROUPED_PROBLEM_DETAILS, normalizeGroupLetter, resolveOperatorId, savePendingToIDB, showToast } = window.DJIConfig;
  const { appState } = window.DJIState;
  const { refreshQueueBadge, trySyncQueueNow } = window.DJIApi;

  let activeStopCategory = "G";
  let activeStopDetail = "Tidak ada order";

  function openMachineStopModal() {
    const modal = document.getElementById("modalMachineStop");
    if (!modal) return;

    // Reset state default
    activeStopCategory = "G";
    const groups = GROUPED_PROBLEM_DETAILS["G"] || [];
    activeStopDetail = groups[0]?.items[0] || "Tidak ada order";

    // Update header info card inside modal
    const txtMc = document.getElementById("txtStopModalMc");
    const txtOp = document.getElementById("txtStopModalOperator");
    const txtShift = document.getElementById("txtStopModalShift");
    const txtPot = document.getElementById("txtStopModalPotongan");
    const txtCatatan = document.getElementById("inpStopModalCatatan");
    const radShift = document.getElementById("radStopCakupanShift");

    if (txtMc) txtMc.textContent = appState.selectedMc || "-";
    if (txtOp) txtOp.textContent = appState.selectedOperator || "-";
    if (txtShift) txtShift.textContent = `Shift ${normalizeGroupLetter(appState.selectedGroup || "A")}`;
    if (txtPot) txtPot.textContent = `#${appState.selectedPotongan || 1}`;
    if (txtCatatan) txtCatatan.value = "";
    if (radShift) radShift.checked = true;

    renderCategoryTabs();
    renderDetailsSelect();

    modal.classList.add("show");
  }

  function closeMachineStopModal() {
    const modal = document.getElementById("modalMachineStop");
    if (modal) modal.classList.remove("show");
  }

  function renderCategoryTabs() {
    const container = document.getElementById("stopCategoryTabsContainer");
    if (!container) return;
    container.innerHTML = "";

    PROBLEM_CATEGORIES.forEach(cat => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = cat.id === activeStopCategory;
      btn.className = `btn-stop-cat-tab ${isActive ? "active" : ""}`;
      btn.innerHTML = `
        <div class="cat-tab-top">
          <span class="cat-code">${cat.id}</span>
          ${isActive ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <div class="cat-short">${cat.short || cat.name}</div>
        <div class="cat-desc">${cat.name.replace(/^Kode [A-G]:\s*/i, "")}</div>
      `;
      btn.onclick = () => selectStopCategory(cat.id);
      container.appendChild(btn);
    });
  }

  function selectStopCategory(catId) {
    activeStopCategory = catId;
    const groups = GROUPED_PROBLEM_DETAILS[catId] || [];
    activeStopDetail = groups[0]?.items[0] || "";
    renderCategoryTabs();
    renderDetailsSelect();
  }

  function renderDetailsSelect() {
    const chipsContainer = document.getElementById("stopDetailsChipsContainer");
    const sel = document.getElementById("selStopModalDetail");
    const lblSelected = document.getElementById("txtStopSelectedDetail");
    const groups = GROUPED_PROBLEM_DETAILS[activeStopCategory] || [];

    if (lblSelected) {
      lblSelected.textContent = activeStopDetail ? `Kode ${activeStopCategory}: ${activeStopDetail}` : "-";
    }

    if (chipsContainer) {
      chipsContainer.innerHTML = "";
      groups.forEach(g => {
        const grpBox = document.createElement("div");
        grpBox.className = "stop-group-box";

        if (g.groupName) {
          const title = document.createElement("div");
          title.className = "stop-group-title";
          title.textContent = g.groupName;
          grpBox.appendChild(title);
        }

        const chipsWrap = document.createElement("div");
        chipsWrap.className = "stop-chips-wrapper";
        g.items.forEach(it => {
          const chip = document.createElement("button");
          chip.type = "button";
          const isChosen = it === activeStopDetail;
          chip.className = `stop-detail-chip ${isChosen ? "active" : ""}`;
          chip.innerHTML = `
            ${isChosen ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            <span>${it}</span>
          `;
          chip.onclick = () => {
            activeStopDetail = it;
            if (sel) sel.value = it;
            renderDetailsSelect();
          };
          chipsWrap.appendChild(chip);
        });

        grpBox.appendChild(chipsWrap);
        chipsContainer.appendChild(grpBox);
      });
    }

    if (sel) {
      sel.innerHTML = "";
      groups.forEach(g => {
        const optGroup = document.createElement("optgroup");
        optGroup.label = g.groupName || "Umum";
        g.items.forEach(it => {
          const opt = document.createElement("option");
          opt.value = it;
          opt.textContent = it;
          if (it === activeStopDetail) opt.selected = true;
          optGroup.appendChild(opt);
        });
        sel.appendChild(optGroup);
      });

      sel.onchange = (e) => {
        activeStopDetail = e.target.value;
        renderDetailsSelect();
      };
    }
  }

  async function saveMachineStopModal() {
    if (!appState.selectedMc) {
      alert("Nomor mesin belum ditentukan!");
      return;
    }
    if (!appState.selectedOperator) {
      alert("Pilih nama operator sebelum melaporkan mesin mati!");
      if (window.openHeaderModal) window.openHeaderModal();
      return;
    }

    const selDetailEl = document.getElementById("selStopModalDetail");
    const chosenDetail = selDetailEl ? selDetailEl.value : activeStopDetail;
    if (!chosenDetail) {
      alert("Pilih detail masalah yang menyebabkan mesin mati!");
      return;
    }

    const inpNote = document.getElementById("inpStopModalCatatan");
    const note = inpNote ? inpNote.value.trim() : "";
    const radFullDay = document.getElementById("radStopCakupanFullDay");
    const cakupan = radFullDay && radFullDay.checked ? "FULL_DAY" : "SHIFT";

    const fullStatus = note ? `${chosenDetail} (${note})` : chosenDetail;
    const nowIso = new Date().toISOString();
    const opShift = window.DJIConfig.getOperationalShift();
    const normGroup = normalizeGroupLetter(appState.selectedGroup || opShift.shiftGroup);
    const groupId = normGroup === "B" ? "2" : normGroup === "C" ? "3" : "1";
    const operatorId = resolveOperatorId(appState.selectedOperator, appState.bootstrap);

    const submitData = {
      nomorMc: appState.selectedMc,
      pic: appState.selectedOperator,
      operatorId: String(operatorId),
      grupId: String(groupId),
      status: fullStatus,
      kategoriMasalah: activeStopCategory,
      cakupan: cakupan,
      potonganKe: String(appState.selectedPotongan || 1),
      designId: String(appState.selectedDesign || "1"),
      rpm: appState.rpm ? String(appState.rpm) : null,
      pick: appState.pick ? String(appState.pick) : null,
      course: appState.course ? String(appState.course) : null,
      idempotencyKey: "status_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
    };

    const payloadId = "status_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const payload = {
      id: payloadId,
      type: "status",
      timestamp: nowIso,
      data: submitData,
      nomorMc: appState.selectedMc,
      operatorName: appState.selectedOperator,
      groupId: normGroup,
      shift: opShift.shiftNumber,
      potonganKe: appState.selectedPotongan || 1,
      designId: appState.selectedDesign || "1",
      panelNo: "BERHENTI",
      inputType: "PANEL",
      jenisLaporan: `Mesin Mati (${activeStopCategory}: ${chosenDetail})`
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
      type: "status",
      timestamp: nowIso,
      data: submitData,
      retryCount: 0
    });

    closeMachineStopModal();
    refreshQueueBadge();
    showToast(`⚠️ Laporan Mesin Mati (${appState.selectedMc}) tersimpan di antrean offline.`);
    trySyncQueueNow();
  }

  window.DJIMachineStop = {
    openMachineStopModal,
    closeMachineStopModal,
    selectStopCategory,
    saveMachineStopModal
  };

  window.openMachineStopModal = openMachineStopModal;
  window.closeMachineStopModal = closeMachineStopModal;
  window.saveMachineStopModal = saveMachineStopModal;

})(window);
