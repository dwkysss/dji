/**
 * Downtime Tracker & Antrean Events Queue
 * Matches DowntimeTracker.tsx 1:1
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { KEYS, PROBLEM_CATEGORIES, GROUPED_PROBLEM_DETAILS, formatDuration, showToast } = window.DJIConfig;
  const { appState } = window.DJIState;

  let liveTimerInterval = null;
  let liveTimerSeconds = 0;

  // Active Classification Modal State
  let currentClassifyingEventId = null;
  let selectedCategoryIds = [];
  let selectedProblemDetails = {}; // { A: ["L1 Putus"], ... }
  let selectedPcsList = [];

  function updateTotalDowntimeDisplay() {
    const totalSec = (appState.downtimeEvents || []).reduce((acc, ev) => acc + (ev.duration || 0), 0);
    const el = document.getElementById("dispTotalDowntime");
    if (el) el.textContent = formatDuration(totalSec);
  }

  function startDowntimeTimer(source = "Manual") {
    if (appState.activeBlock) {
      showToast("Mesin sedang diblokir (dalam perbaikan). Gunakan tombol UNBLOCK MESIN jika selesai.");
      return;
    }
    if (liveTimerInterval) return;
    liveTimerSeconds = 0;

    const container = document.getElementById("downtimeControlsContainer");
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="dot-ping-amber" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span>
            <span style="font-size:12px; font-weight:800; color:#b45309;">Downtime Berjalan:</span>
          </div>
          <span id="txtLiveDowntimeTimer" style="font-size:16px; font-weight:900; font-family:monospace; color:#b45309;">00:00</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;">
          <button type="button" class="btn-mulai-manual" style="background:#ef4444; box-shadow:0 2px 8px rgba(239,68,68,0.3); border:none;" onclick="DJIDowntime.stopAndSaveDowntime('${source}')">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px; height:14px;"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            <span>SELESAI & SIMPAN</span>
          </button>
          <button type="button" style="border:1px solid #cbd5e1; background:#ffffff; color:#64748b; font-size:11px; font-weight:800; border-radius:12px; cursor:pointer;" onclick="DJIDowntime.cancelDowntimeTimer()">
            BATAL
          </button>
        </div>
      </div>
    `;

    liveTimerInterval = setInterval(() => {
      liveTimerSeconds++;
      const el = document.getElementById("txtLiveDowntimeTimer");
      if (el) el.textContent = formatDuration(liveTimerSeconds);

      // Auto-block jika mesin mati >= 1 jam (3600 detik)
      if (liveTimerSeconds >= 3600 && window.DJIBlockMesin && window.DJIBlockMesin.executeAutoBlockOffline) {
        window.DJIBlockMesin.executeAutoBlockOffline(liveTimerSeconds);
      }
    }, 1000);
  }

  function startDowntimeTimerFromEsp32(initialSec) {
    if (appState.activeBlock) return;
    if (liveTimerInterval) {
      if (typeof initialSec === "number" && initialSec > 0) {
        liveTimerSeconds = initialSec;
      }
      return;
    }
    startDowntimeTimer("ESP32");
    if (typeof initialSec === "number" && initialSec > 0) {
      liveTimerSeconds = initialSec;
    }
  }

  function stopAndSaveDowntime(source = "Manual", explicitDuration) {
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }

    const dur = typeof explicitDuration === "number" && explicitDuration > 0
      ? explicitDuration
      : (liveTimerSeconds > 0 ? liveTimerSeconds : 1);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const newEvt = {
      id: "evt_" + Date.now(),
      duration: dur,
      durasiDetik: dur,
      durationStr: formatDuration(dur),
      timestamp: timeStr,
      selected: false,
      category: null,
      kategori: null,
      detail: null,
      details: [],
      blok: null,
      pcsKe: appState.pcsCount > 1 ? [] : ["1"],
      meter: null,
      triggerSource: source,
      isResolved: false
    };

    if (!appState.downtimeEvents) appState.downtimeEvents = [];
    appState.downtimeEvents.push(newEvt);
    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));

    resetDowntimeButton();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast(`Downtime ${newEvt.durationStr} tercatat! Silakan klasifikasikan masalah.`);

    // Segera tampilkan modal klasifikasi masalah 1:1 seperti DowntimeTracker.tsx
    openClassifyModal(newEvt.id);
  }

  function stopAndSaveDowntimeFromEsp32(explicitDuration) {
    stopAndSaveDowntime("ESP32 Sensor", explicitDuration);
  }

  function cancelDowntimeTimer() {
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    resetDowntimeButton();
  }

  function resetDowntimeButton() {
    const container = document.getElementById("downtimeControlsContainer");
    if (!container) return;
    container.innerHTML = `
      <button type="button" id="btnMulaiManual" class="btn-mulai-manual" onclick="DJIDowntime.startDowntimeTimer()">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>MULAI MANUAL</span>
      </button>
    `;
  }

  function renderAntreanEvents() {
    const container = document.getElementById("boxDowntimeEventsContainer");
    const grid = document.getElementById("downtimeEventsGrid");
    const boxAntrean = document.getElementById("boxSectionAntrean");
    const boxRiwayat = document.getElementById("boxSectionRiwayat");
    const listAntrean = document.getElementById("antreanEventsList");
    const listRiwayat = document.getElementById("riwayatEventsList");
    const badgeAntrean = document.getElementById("badgeAntreanCount");
    const badgeRiwayat = document.getElementById("badgeRiwayatCount");
    const chkSelectAll = document.getElementById("chkSelectAllEvents");
    const boxBatch = document.getElementById("boxBatchActions");
    const txtBatchCount = document.getElementById("txtBatchSelectedCount");

    const events = appState.downtimeEvents || [];

    if (events.length === 0) {
      if (container) container.style.display = "none";
      if (boxAntrean) boxAntrean.style.display = "none";
      if (boxRiwayat) boxRiwayat.style.display = "none";
      if (listAntrean) listAntrean.innerHTML = "";
      if (listRiwayat) listRiwayat.innerHTML = "";
      return;
    }

    if (container) container.style.display = "block";

    // Split events into unclassified vs resolved
    const unclassified = [];
    const resolved = [];

    events.forEach((evt) => {
      const isResolved = evt.isResolved !== false && (evt.isResolved || (evt.problems && evt.problems.length > 0) || evt.category);
      if (isResolved) {
        resolved.push(evt);
      } else {
        unclassified.push(evt);
      }
    });

    // Toggle 2-cols grid layout
    if (grid) {
      if (unclassified.length > 0 && resolved.length > 0) {
        grid.className = "downtime-events-grid two-cols";
      } else {
        grid.className = "downtime-events-grid";
      }
    }

    // 1. Render ANTREAN (Unclassified)
    if (unclassified.length === 0) {
      if (boxAntrean) boxAntrean.style.display = "none";
      if (listAntrean) listAntrean.innerHTML = "";
    } else {
      if (boxAntrean) boxAntrean.style.display = "flex";
      if (badgeAntrean) badgeAntrean.textContent = `${unclassified.length} Event`;
      if (listAntrean) {
        listAntrean.innerHTML = "";

        const allChecked = unclassified.length > 0 && unclassified.every(e => e.selected);
        if (chkSelectAll) chkSelectAll.checked = allChecked;

        const selectedCount = unclassified.filter(e => e.selected).length;
        if (boxBatch && txtBatchCount) {
          if (selectedCount > 0) {
            boxBatch.style.display = "flex";
            txtBatchCount.textContent = `Terpilih ${selectedCount} dari ${unclassified.length} Event`;
          } else {
            boxBatch.style.display = "none";
          }
        }

        unclassified.forEach((evt) => {
          const card = document.createElement("div");
          card.className = `antrean-unclassified-card ${evt.selected ? 'selected' : ''}`;
          card.innerHTML = `
            <div class="unclassified-card-top">
              <div style="display:flex; align-items:center; gap:6px;">
                <input type="checkbox" style="width:14px; height:14px; cursor:pointer;" ${evt.selected ? 'checked' : ''} onchange="DJIDowntime.toggleSelectEvent('${evt.id}', this.checked)">
                <span class="badge-duration-yellow">${evt.durationStr || formatDuration(evt.duration || evt.durasiDetik || 0)}</span>
                <span class="event-time-text">• Jam ${evt.timestamp}</span>
              </div>
              ${evt.meter ? `<span class="badge-meter-pill">${evt.meter}m</span>` : ''}
            </div>
            <div class="unclassified-card-actions">
              <button type="button" class="btn-gagal-cacat" onclick="DJIDowntime.resolveEventGlitch('${evt.id}')" title="Tandai sebagai false alarm (gagal cacat)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Gagal Cacat</span>
              </button>
              <button type="button" class="btn-klasifikasi" onclick="DJIDowntime.openClassifyModal('${evt.id}')" title="Isi detail kendala/cacat kain">
                <span>+ Klasifikasi</span>
              </button>
              <button type="button" class="btn-delete-icon" onclick="DJIDowntime.deleteEvent('${evt.id}')" title="Hapus Event">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:14px; height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          `;
          listAntrean.appendChild(card);
        });
      }
    }

    // 2. Render RIWAYAT BERHENTI (Resolved / Classified)
    if (resolved.length === 0) {
      if (boxRiwayat) boxRiwayat.style.display = "none";
      if (listRiwayat) listRiwayat.innerHTML = "";
    } else {
      if (boxRiwayat) boxRiwayat.style.display = "flex";
      if (badgeRiwayat) badgeRiwayat.textContent = `${resolved.length} KEJADIAN`;
      if (listRiwayat) {
        listRiwayat.innerHTML = "";
        resolved.forEach((evt) => {
          const card = document.createElement("div");
          card.className = "riwayat-resolved-card";

          const isGagalCacat = evt.isSensorGlitch || evt.category === "G" || (evt.detail && evt.detail.toUpperCase().includes("GAGAL CACAT"));
          const detailsStr = Array.isArray(evt.details) ? evt.details.join(", ") : (evt.detail || "");
          
          let pcsLabel = "";
          if (Array.isArray(evt.pcsKe)) {
            pcsLabel = evt.pcsKe.join(", ");
          } else if (typeof evt.pcsKe === "string") {
            pcsLabel = evt.pcsKe.trim();
          }
          const showPcs = pcsLabel && pcsLabel !== "Semua";

          card.innerHTML = `
            <div class="resolved-card-left">
              <div class="resolved-card-meta">
                <span class="resolved-duration-badge">${evt.durationStr || formatDuration(evt.duration || evt.durasiDetik || 0)}</span>
                ${showPcs ? `<span class="resolved-pcs-badge">PCS ${pcsLabel}</span>` : ''}
                ${evt.meter ? `<span class="badge-meter-pill">${evt.meter}m</span>` : ''}
                <span class="event-time-text">• Jam ${evt.timestamp}</span>
                ${isGagalCacat ? `<span class="badge-gagal-tag">Gagal Cacat</span>` : ''}
              </div>
              ${!isGagalCacat ? `
                <div class="resolved-problem-line">
                  <span class="resolved-category-bold">Kode ${evt.category}:</span>
                  <span class="resolved-detail-text">${detailsStr}</span>
                  ${evt.blok ? `<span class="resolved-blok-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> Blok ${evt.blok}</span>` : ''}
                </div>
              ` : ''}
            </div>
            <div class="resolved-card-actions">
              <button type="button" class="btn-ubah-resolved" onclick="DJIDowntime.openClassifyModal('${evt.id}')" title="Ubah detail kendala">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Ubah</span>
              </button>
              <button type="button" class="btn-delete-icon" onclick="DJIDowntime.deleteEvent('${evt.id}')" title="Hapus Event">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          `;
          listRiwayat.appendChild(card);
        });
      }
    }
  }

  function toggleSelectAllEvents(checked) {
    const events = appState.downtimeEvents || [];
    events.forEach(e => {
      const isResolved = e.isResolved !== false && (e.isResolved || (e.problems && e.problems.length > 0) || e.category);
      if (!isResolved) {
        e.selected = checked;
      }
    });
    renderAntreanEvents();
  }

  function toggleSelectEvent(id, checked) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (evt) evt.selected = checked;
    renderAntreanEvents();
  }

  function resolveEventGlitch(id) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (!evt) return;

    evt.category = "G";
    evt.kategori = "G";
    evt.detail = "Gagal Cacat";
    evt.details = ["Gagal Cacat"];
    evt.isResolved = true;
    evt.isSensorGlitch = true;
    evt.problems = [
      {
        kategori: "G",
        details: ["Gagal Cacat"],
        pcsKe: evt.pcsKe || "1"
      }
    ];

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast("Event ditandai sebagai Gagal Cacat (false alarm).");
  }

  function batchResolveSensorGlitch() {
    const events = appState.downtimeEvents || [];
    const selected = events.filter(e => e.selected && (!e.isResolved || !e.category));
    if (selected.length === 0) return;
    selected.forEach(evt => {
      evt.category = "G";
      evt.kategori = "G";
      evt.detail = "Gagal Cacat";
      evt.details = ["Gagal Cacat"];
      evt.isResolved = true;
      evt.isSensorGlitch = true;
      evt.selected = false;
      evt.problems = [
        {
          kategori: "G",
          details: ["Gagal Cacat"],
          pcsKe: evt.pcsKe || "1"
        }
      ];
    });
    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast(`${selected.length} event ditandai sebagai Gagal Cacat.`);
  }

  function deleteEvent(id) {
    if (!confirm("Hapus event downtime ini?")) return;
    appState.downtimeEvents = (appState.downtimeEvents || []).filter(e => e.id !== id);
    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast("Event downtime dihapus.");
  }

  /* ── Modal Klasifikasi Masalah Logika Lengkap ── */
  function openClassifyModal(id) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (!evt) return;

    currentClassifyingEventId = id;

    // Durasi Teks
    const durEl = document.getElementById("classifyDurationText");
    if (durEl) durEl.textContent = evt.durationStr || formatDuration(evt.duration || 0);

    // Initial state from event
    selectedCategoryIds = evt.category && evt.category !== "G" ? [evt.category] : [];
    selectedProblemDetails = {};
    if (evt.category && evt.category !== "G" && Array.isArray(evt.details)) {
      selectedProblemDetails[evt.category] = [...evt.details];
    } else if (evt.category && evt.category !== "G" && evt.detail) {
      selectedProblemDetails[evt.category] = [evt.detail];
    }

    // PCS Setup
    const pcsBox = document.getElementById("classifyPcsBox");
    const pcsGrid = document.getElementById("classifyPcsButtonGrid");
    const pcsCount = appState.pcsCount || 1;

    if (pcsCount > 1 && pcsBox && pcsGrid) {
      pcsBox.style.display = "block";
      pcsGrid.innerHTML = "";

      if (Array.isArray(evt.pcsKe) && evt.pcsKe.length > 0) {
        selectedPcsList = [...evt.pcsKe];
      } else if (typeof evt.pcsKe === "string" && evt.pcsKe.trim()) {
        if (evt.pcsKe === "Semua") {
          selectedPcsList = [];
          for (let i = 1; i <= pcsCount; i++) selectedPcsList.push(String(i));
        } else {
          selectedPcsList = evt.pcsKe.split(",").map(s => s.trim());
        }
      } else {
        // Default: pilih semua PCS
        selectedPcsList = [];
        for (let i = 1; i <= pcsCount; i++) selectedPcsList.push(String(i));
      }

      for (let i = 1; i <= pcsCount; i++) {
        const pcsStr = String(i);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = `btnClassifyPcs_${pcsStr}`;
        btn.className = `pcs-pill-btn ${selectedPcsList.includes(pcsStr) ? "active" : ""}`;
        btn.textContent = `PCS ${pcsStr}`;
        btn.onclick = () => toggleClassifyPcs(pcsStr);
        pcsGrid.appendChild(btn);
      }
    } else {
      if (pcsBox) pcsBox.style.display = "none";
      selectedPcsList = ["1"];
    }

    // Meter Setup
    const meterBox = document.getElementById("classifyMeterBox");
    const inpMeter = document.getElementById("classifyInpMeter");
    if (appState.currentMode === "METER" && meterBox) {
      meterBox.style.display = "block";
      const currentMeterAkhir = document.getElementById("inpMeterAkhir")?.value || "";
      if (inpMeter) inpMeter.value = evt.meter || currentMeterAkhir || "";
    } else {
      if (meterBox) meterBox.style.display = "none";
    }

    // Blok Setup
    const blockBox = document.getElementById("classifyBlockContainer");
    const inpBlok = document.getElementById("classifyInpBlok");
    if (blockBox) blockBox.style.display = "block";
    if (inpBlok) inpBlok.value = evt.blok || "";

    // Render Categories & Groups
    renderCategoryList();

    // Show modal
    const modal = document.getElementById("modalClassify");
    if (modal) modal.classList.add("show");
  }

  function closeClassifyModal() {
    const modal = document.getElementById("modalClassify");
    if (modal) modal.classList.remove("show");
    currentClassifyingEventId = null;
  }

  function toggleClassifyPcs(pcsStr) {
    if (selectedPcsList.includes(pcsStr)) {
      selectedPcsList = selectedPcsList.filter(p => p !== pcsStr);
    } else {
      selectedPcsList.push(pcsStr);
    }

    const btn = document.getElementById(`btnClassifyPcs_${pcsStr}`);
    if (btn) {
      if (selectedPcsList.includes(pcsStr)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  }

  function toggleSelectAllClassifyPcs() {
    const pcsCount = appState.pcsCount || 1;
    if (selectedPcsList.length === pcsCount) {
      selectedPcsList = [];
    } else {
      selectedPcsList = [];
      for (let i = 1; i <= pcsCount; i++) selectedPcsList.push(String(i));
    }

    for (let i = 1; i <= pcsCount; i++) {
      const pcsStr = String(i);
      const btn = document.getElementById(`btnClassifyPcs_${pcsStr}`);
      if (btn) {
        if (selectedPcsList.includes(pcsStr)) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    }
  }

  function renderCategoryList() {
    const container = document.getElementById("classifyCategoryList");
    if (!container) return;
    container.innerHTML = "";

    const categories = PROBLEM_CATEGORIES || [];
    categories.forEach((cat) => {
      const isSelected = selectedCategoryIds.includes(cat.id);
      const chosenCount = (selectedProblemDetails[cat.id] || []).length;

      const card = document.createElement("div");
      card.className = "cat-card-item";

      const header = document.createElement("div");
      header.className = `cat-card-header ${isSelected ? "active" : ""}`;
      header.onclick = () => toggleCategory(cat.id);

      header.innerHTML = `
        <div class="cat-header-title">
          <span class="cat-badge-id">${cat.id}</span>
          <span style="font-weight:700;">${cat.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${chosenCount > 0 ? `<span style="font-size:10px; font-weight:800; background:#0284c7; color:#fff; padding:2px 8px; border-radius:9999px;">${chosenCount} dipilih</span>` : ''}
          <svg class="btn-cat-expand-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:${isSelected ? 'rotate(180deg)' : 'rotate(0deg)'}; transition:transform 0.2s;">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      `;

      card.appendChild(header);

      if (isSelected) {
        const subBox = document.createElement("div");
        subBox.className = "cat-details-subbox";

        const groups = GROUPED_PROBLEM_DETAILS[cat.id] || [];
        groups.forEach((grp) => {
          const grpWrapper = document.createElement("div");
          grpWrapper.innerHTML = `<span class="subgroup-title">${grp.groupName}</span>`;

          const grid = document.createElement("div");
          grid.className = "detail-pills-grid";

          grp.items.forEach((item) => {
            const isItemActive = (selectedProblemDetails[cat.id] || []).includes(item);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `detail-pill-btn ${isItemActive ? "active" : ""}`;
            btn.textContent = item;
            btn.onclick = (e) => {
              e.stopPropagation();
              toggleProblemDetail(cat.id, item);
            };
            grid.appendChild(btn);
          });

          grpWrapper.appendChild(grid);
          subBox.appendChild(grpWrapper);
        });

        card.appendChild(subBox);
      }

      container.appendChild(card);
    });
  }

  function toggleCategory(catId) {
    if (selectedCategoryIds.includes(catId)) {
      selectedCategoryIds = selectedCategoryIds.filter(id => id !== catId);
    } else {
      selectedCategoryIds.push(catId);
    }
    renderCategoryList();
  }

  function toggleProblemDetail(catId, itemName) {
    if (!selectedProblemDetails[catId]) {
      selectedProblemDetails[catId] = [];
    }

    if (selectedProblemDetails[catId].includes(itemName)) {
      selectedProblemDetails[catId] = selectedProblemDetails[catId].filter(x => x !== itemName);
    } else {
      selectedProblemDetails[catId].push(itemName);
    }

    // Auto-select category if not selected
    if (!selectedCategoryIds.includes(catId)) {
      selectedCategoryIds.push(catId);
    }

    renderCategoryList();
  }

  function saveClassifyAsGagalCacat() {
    if (!currentClassifyingEventId) return;

    const evt = (appState.downtimeEvents || []).find(e => e.id === currentClassifyingEventId);
    if (!evt) return;

    const inpMeter = document.getElementById("classifyInpMeter");
    const meterVal = inpMeter ? inpMeter.value.trim() : null;

    evt.category = "G";
    evt.kategori = "G";
    evt.detail = "Gagal Cacat";
    evt.details = ["Gagal Cacat"];
    evt.blok = null;
    evt.meter = meterVal || null;
    evt.durasiDetik = evt.duration;
    evt.dikerjakanOleh = appState.selectedOperator || "Operator";
    const pcsCount = appState.pcsCount || 1;
    evt.pcsKe = selectedPcsList.length === pcsCount ? "Semua" : (selectedPcsList.join(", ") || "Semua");
    evt.isResolved = true;
    evt.isSensorGlitch = true;
    evt.problems = [
      {
        kategori: "G",
        details: ["Gagal Cacat"],
        blok: undefined,
        meter: meterVal || undefined,
        pcsKe: evt.pcsKe
      }
    ];

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    closeClassifyModal();
    showToast("Downtime disimpan sebagai Gagal Cacat.");
  }

  function saveClassifyProblems() {
    if (!currentClassifyingEventId) return;

    const evt = (appState.downtimeEvents || []).find(e => e.id === currentClassifyingEventId);
    if (!evt) return;

    // Validasi Kategori & Detail
    const allChosenDetails = [];
    let primaryCat = null;

    selectedCategoryIds.forEach((catId) => {
      const items = selectedProblemDetails[catId] || [];
      if (items.length > 0) {
        if (!primaryCat) primaryCat = catId;
        items.forEach(it => allChosenDetails.push(it));
      }
    });

    if (!primaryCat || allChosenDetails.length === 0) {
      alert("Pilih minimal 1 kategori dan 1 detail masalah sebelum menyimpan!");
      return;
    }

    // Validasi PCS
    const pcsCount = appState.pcsCount || 1;
    if (pcsCount > 1 && selectedPcsList.length === 0) {
      alert("Pilih minimal 1 PCS yang mengalami masalah!");
      return;
    }

    // Validasi Meter jika mode meter
    const inpMeter = document.getElementById("classifyInpMeter");
    const meterVal = inpMeter ? inpMeter.value.trim() : null;
    if (appState.currentMode === "METER" && !meterVal) {
      alert("Posisi letak meter wajib diisi!");
      if (inpMeter) inpMeter.focus();
      return;
    }

    const inpBlok = document.getElementById("classifyInpBlok");
    const blokVal = inpBlok ? inpBlok.value.trim() : null;

    evt.category = primaryCat;
    evt.kategori = primaryCat;
    evt.detail = allChosenDetails.join(", ");
    evt.details = allChosenDetails;
    evt.blok = blokVal || null;
    evt.meter = meterVal || null;
    evt.durasiDetik = evt.duration;
    evt.dikerjakanOleh = appState.selectedOperator || "Operator";
    evt.pcsKe = pcsCount > 1
      ? (selectedPcsList.length === pcsCount ? "Semua" : selectedPcsList.join(", "))
      : "1";
    evt.isResolved = true;
    evt.isSensorGlitch = false;
    evt.problems = [
      {
        kategori: primaryCat,
        details: allChosenDetails,
        blok: blokVal || undefined,
        meter: meterVal || undefined,
        pcsKe: evt.pcsKe
      }
    ];

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    closeClassifyModal();
    showToast("Klasifikasi masalah berhasil disimpan!");
  }

  window.DJIDowntime = {
    startDowntimeTimer,
    startDowntimeTimerFromEsp32,
    stopAndSaveDowntime,
    stopAndSaveDowntimeFromEsp32,
    cancelDowntimeTimer,
    updateTotalDowntimeDisplay,
    renderAntreanEvents,
    toggleSelectAllEvents,
    toggleSelectEvent,
    resolveEventGlitch,
    batchResolveSensorGlitch,
    deleteEvent,
    openClassifyModal,
    closeClassifyModal,
    toggleClassifyPcs,
    toggleSelectAllClassifyPcs,
    saveClassifyAsGagalCacat,
    saveClassifyProblems
  };
})(window);
