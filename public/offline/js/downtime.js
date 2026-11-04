  function syncDowntimeToDraftPanel() {
    try {
      const rawDraft = localStorage.getItem("dji_form_draft_panel");
      if (rawDraft) {
        const pd = JSON.parse(rawDraft);
        if (pd && pd.nomorMc && pd.nomorMc.toUpperCase() === (appState.selectedMc || "").toUpperCase()) {
          pd.downtimeEvents = appState.downtimeEvents || [];
          const totalSec = (appState.downtimeEvents || []).reduce((acc, ev) => acc + (ev.durasiDetik || 0), 0);
          const m = Math.floor(totalSec / 60);
          const s = totalSec % 60;
          pd.totalDowntime = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
          localStorage.setItem("dji_form_draft_panel", JSON.stringify(pd));
        }
      }
    } catch (e) {}
  }
/**
 * Downtime Tracker & Antrean Events Queue
 * Matches DowntimeTracker.tsx 1:1 (Multi-PCS, Per-PCS Defect & Meter Inputs)
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
  let batchClassifyingEventIds = [];
  let selectedCategoryIds = [];
  let selectedProblemDetails = {}; // { A: ["L1 Putus"], ... }
  let selectedPcsList = [];

  // Multi-PCS Meter State (1:1 DowntimeTracker.tsx)
  let inputMeters = {}; // { "1": "198", "2": "198", "3": "198" }
  let customizedPcsKeys = {}; // { "1": true }
  let leaderPcsKey = null;

  // Multi-PCS Problem Mode ("same" vs "per_pcs") (1:1 DowntimeTracker.tsx)
  let problemInputMode = "same";
  let activePcsProblemTab = "1";
  let perPcsProblems = {}; // { "1": { categories: [], details: {}, blok: "" } }

  function getEffectivePcsCount() {
    if (window.DJIState && typeof window.DJIState.getEffectivePcsCount === "function") {
      return window.DJIState.getEffectivePcsCount();
    }
    const mc = (appState.selectedMc || "").toUpperCase();
    const snap = appState.bootstrap?.snapshots?.[mc];
    const snapPcs = snap?.defaultPcs || (snap?.pcs ? parseInt(snap.pcs, 10) : null);
    if (snapPcs && snapPcs > 0) return snapPcs;
    if (appState.currentPcs && appState.currentPcs > 1) return appState.currentPcs;
    if (appState.pcsCount && appState.pcsCount > 1) return appState.pcsCount;
    if (["R11", "R12", "R13", "R16"].includes(mc)) return 3;
    if (["T2", "T2A"].includes(mc)) return 2;
    return 1;
  }

  function updateTotalDowntimeDisplay() {
    const totalSec = (appState.downtimeEvents || []).reduce((acc, ev) => acc + (ev.duration || ev.durasiDetik || 0), 0);
    const el = document.getElementById("dispTotalDowntime");
    if (el) el.textContent = formatDuration(totalSec);
    const btnReset = document.getElementById("btnResetDowntime");
    if (btnReset) btnReset.style.display = totalSec > 0 ? "inline-block" : "none";
  }

  function resetAllDowntime() {
    if (!confirm("Hapus seluruh rekaman downtime dan antrean kendala saat ini?")) return;
    appState.downtimeEvents = [];
    localStorage.removeItem(KEYS.DOWNTIME);
    localStorage.removeItem("dji_active_downtime_start");
    localStorage.removeItem("dji_active_timer_source");
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    liveTimerSeconds = 0;
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    renderResolvedEvents();
    renderDowntimeControls();
    showToast("Seluruh downtime berhasil direset ke 00:00.");
  }

  function isTimerRunning() {
    return liveTimerInterval !== null || Boolean(localStorage.getItem("dji_active_downtime_start"));
  }

  function restoreActiveTimerIfNeeded() {
    const savedStart = localStorage.getItem("dji_active_downtime_start");
    if (!savedStart) return;
    const startTime = parseInt(savedStart, 10);
    if (isNaN(startTime)) {
      localStorage.removeItem("dji_active_downtime_start");
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    if (elapsed > 86400) {
      localStorage.removeItem("dji_active_downtime_start");
      return;
    }
    const savedSrc = localStorage.getItem("dji_active_timer_source") || "Manual";
    startDowntimeTimer(savedSrc, elapsed);
  }

  function startDowntimeTimer(source = "Manual", initialSec = 0) {
    if (appState.activeBlock) {
      showToast("Mesin sedang diblokir (dalam perbaikan). Gunakan tombol UNBLOCK MESIN jika selesai.");
      return;
    }
    if (liveTimerInterval) return;

    const savedStart = localStorage.getItem("dji_active_downtime_start");
    if (!savedStart) {
      localStorage.setItem("dji_active_downtime_start", String(Date.now()));
      localStorage.setItem("dji_active_timer_source", source);
    }
    liveTimerSeconds = typeof initialSec === "number" && initialSec > 0 ? initialSec : 0;

    const container = document.getElementById("downtimeControlsContainer");
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="dot-ping-amber" style="background:#ef4444; box-shadow:0 0 8px #ef4444;"></span>
            <span style="font-size:12px; font-weight:800; color:#b45309;">Downtime Berjalan:</span>
          </div>
          <span id="txtLiveDowntimeTimer" style="font-size:16px; font-weight:900; font-family:monospace; color:#b45309;">${formatDuration(liveTimerSeconds)}</span>
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
    startDowntimeTimer("ESP32", initialSec);
  }

  function stopAndSaveDowntime(source = "Manual", explicitDuration) {
    const hasInterval = Boolean(liveTimerInterval);
    const savedStart = localStorage.getItem("dji_active_downtime_start");
    const hasSavedStart = Boolean(savedStart);
    const hasExplicit = typeof explicitDuration === "number" && explicitDuration > 0;

    if (!hasInterval && !hasSavedStart && !hasExplicit) {
      console.log("[Downtime] stopAndSaveDowntime diabaikan karena tidak ada timer aktif.");
      return;
    }

    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }

    let durationSec = 0;
    if (hasExplicit) {
      durationSec = explicitDuration;
    } else if (savedStart) {
      const startTime = parseInt(savedStart, 10);
      durationSec = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    } else {
      durationSec = liveTimerSeconds > 0 ? liveTimerSeconds : 1;
    }

    localStorage.removeItem("dji_active_downtime_start");
    localStorage.removeItem("dji_active_timer_source");
    liveTimerSeconds = 0;

    const pcsCount = getEffectivePcsCount();

    const newEvt = {
      id: "dt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      source: source,
      duration: durationSec,
      durationStr: formatDuration(durationSec),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(".", ":"),
      pcsKe: pcsCount > 1 ? "" : "1",
      isResolved: false,
      isSensorGlitch: false,
      selected: false
    };

    if (!appState.downtimeEvents) appState.downtimeEvents = [];
    appState.downtimeEvents.push(newEvt);
    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();

    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    renderDowntimeControls();

    // Buka modal klasifikasi secara otomatis untuk event baru ini
    openClassifyModal(newEvt.id);
  }

  function stopAndSaveDowntimeFromEsp32(durationSec) {
    if (typeof durationSec !== "number" || durationSec <= 0) return;
    stopAndSaveDowntime("ESP32", durationSec);
  }

  function cancelDowntimeTimer() {
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    localStorage.removeItem("dji_active_downtime_start");
    localStorage.removeItem("dji_active_timer_source");
    liveTimerSeconds = 0;
    renderDowntimeControls();
    showToast("Timer downtime dibatalkan.");
  }

  function renderDowntimeControls() {
    const container = document.getElementById("downtimeControlsContainer");
    if (!container) return;

    if (appState.activeBlock) {
      container.innerHTML = `
        <button type="button" class="btn-mulai-manual" style="background:#0f172a; color:#fff;" onclick="DJIBlockMesin.openUnblockModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>UNBLOCK MESIN</span>
        </button>
      `;
      return;
    }

    container.innerHTML = `
      <button type="button" class="btn-mulai-manual" onclick="DJIDowntime.startDowntimeTimer('Manual')">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px; height:16px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>MULAI MANUAL</span>
      </button>
    `;
  }

  function updateDowntimeOuterContainer() {
    const outerContainer = document.getElementById("boxDowntimeEventsContainer");
    const grid = document.getElementById("downtimeEventsGrid");
    if (!outerContainer) return;
    const events = appState.downtimeEvents || [];
    outerContainer.style.display = events.length > 0 ? "block" : "none";

    const hasUnresolved = events.some(e => !e.isResolved);
    const hasResolved = events.some(e => e.isResolved);
    if (grid) {
      if (hasUnresolved && hasResolved) {
        grid.className = "downtime-events-grid two-cols";
      } else {
        grid.className = "downtime-events-grid";
      }
    }
  }

  function renderAntreanEvents() {
    updateDowntimeOuterContainer();
    const listEl = document.getElementById("antreanEventsList");
    const countBadge = document.getElementById("badgeAntreanCount") || document.getElementById("lblAntreanCount");
    const container = document.getElementById("boxSectionAntrean") || document.getElementById("antreanSectionContainer");
    const checkAll = document.getElementById("chkSelectAllEvents");

    if (!listEl) return;
    const events = appState.downtimeEvents || [];
    const unresolved = events.filter(e => !e.isResolved);

    if (countBadge) countBadge.textContent = `${unresolved.length} Event`;

    const batchActionsBox = document.getElementById("boxBatchActions");
    const txtBatchCount = document.getElementById("txtBatchSelectedCount");
    const txtBtnBatchClassify = document.getElementById("txtBtnBatchClassify");
    const selectedUnclassified = unresolved.filter(e => e.selected);

    if (batchActionsBox) {
      if (selectedUnclassified.length > 0) {
        batchActionsBox.style.display = "flex";
        if (txtBatchCount) txtBatchCount.textContent = `Terpilih ${selectedUnclassified.length} Event`;
        if (txtBtnBatchClassify) txtBtnBatchClassify.textContent = `Klasifikasi Sekaligus (${selectedUnclassified.length})`;
      } else {
        batchActionsBox.style.display = "none";
      }
    }

    if (unresolved.length === 0) {
      if (container) container.style.display = "none";
      if (batchActionsBox) batchActionsBox.style.display = "none";
      listEl.innerHTML = "";
      if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
      }
      renderResolvedEvents();
      return;
    }

    if (container) container.style.display = "block";
    listEl.innerHTML = "";

    const allChecked = unresolved.length > 0 && unresolved.every(e => e.selected);
    const someChecked = unresolved.some(e => e.selected);
    if (checkAll) {
      checkAll.checked = allChecked;
      checkAll.indeterminate = !allChecked && someChecked;
    }

    unresolved.forEach((evt) => {
      const card = document.createElement("div");
      card.className = "antrean-unclassified-card" + (evt.selected ? " selected" : "");

      card.innerHTML = `
        <div class="unclassified-card-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" ${evt.selected ? 'checked' : ''} onchange="DJIDowntime.toggleSelectEvent('${evt.id}')" />
            <span class="badge-duration-yellow">${evt.durationStr || formatDuration(evt.duration || 0)}</span>
            <span class="event-time-text">• Jam ${evt.timeFormatted || "-"}</span>
            ${evt.source === "ESP32" ? '<span class="badge-meter-pill" style="background:#e0f2fe; color:#0284c7; border-color:#bae6fd;">ESP32</span>' : ''}
          </div>
          <button type="button" onclick="DJIDowntime.deleteEvent('${evt.id}')" title="Hapus Event" style="background:none; border:none; cursor:pointer; padding:4px; color:#94a3b8; display:flex; align-items:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="unclassified-card-actions">
          <button type="button" class="btn-gagal-cacat" onclick="DJIDowntime.resolveEventGlitch('${evt.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Gagal Cacat</span>
          </button>
          <button type="button" class="btn-klasifikasi" onclick="DJIDowntime.openClassifyModal('${evt.id}')">
            <span>+ Klasifikasi</span>
          </button>
        </div>
      `;

      listEl.appendChild(card);
    });

    renderResolvedEvents();
  }

  function renderResolvedEvents() {
    updateDowntimeOuterContainer();
    const listEl = document.getElementById("riwayatEventsList") || document.getElementById("resolvedEventsList");
    const countBadge = document.getElementById("badgeRiwayatCount") || document.getElementById("lblResolvedCount");
    const container = document.getElementById("boxSectionRiwayat") || document.getElementById("resolvedSectionContainer");

    if (!listEl) return;
    const events = appState.downtimeEvents || [];
    const resolved = events.filter(e => e.isResolved);

    if (countBadge) countBadge.textContent = `${resolved.length} KEJADIAN`;

    if (resolved.length === 0) {
      if (container) container.style.display = "none";
      listEl.innerHTML = "";
      return;
    }

    if (container) container.style.display = "block";
    listEl.innerHTML = "";

    resolved.forEach((evt) => {
      const card = document.createElement("div");
      card.className = "riwayat-resolved-card";

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
            <span class="resolved-duration-badge">${evt.durationStr || formatDuration(evt.duration || 0)}</span>
            <span class="event-time-text">• Jam ${evt.timeFormatted || "-"}</span>
            ${showPcs ? `<span class="resolved-pcs-badge">PCS ${pcsLabel}</span>` : ''}
            ${evt.meter ? `<span class="badge-meter-pill">${evt.meter}m</span>` : ''}
          </div>
          <div class="resolved-problem-line">
            ${evt.isSensorGlitch ? `
              <span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#059669;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Gagal Cacat</span>
              </span>
            ` : `
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div>
                  <span class="resolved-category-bold">Kode ${evt.category || "A"}:</span>
                  <span class="resolved-detail-text">${evt.detail || "Masalah Mesin"}</span>
                </div>
                ${evt.blok ? `<span class="resolved-blok-badge">Blok: ${evt.blok}</span>` : ''}
              </div>
            `}
          </div>
        </div>
        <button type="button" onclick="DJIDowntime.deleteEvent('${evt.id}')" title="Hapus Laporan" style="background:none; border:none; cursor:pointer; padding:4px; color:#94a3b8; display:flex; align-items:center;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;

      listEl.appendChild(card);
    });
  }

  function toggleSelectAllEvents(overrideChecked) {
    const checkAll = document.getElementById("chkSelectAllEvents");
    const isChecked = typeof overrideChecked === "boolean" ? overrideChecked : (checkAll ? checkAll.checked : false);
    (appState.downtimeEvents || []).forEach(e => {
      if (!e.isResolved) e.selected = isChecked;
    });
    renderAntreanEvents();
  }

  function toggleSelectEvent(id) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (evt) evt.selected = !evt.selected;
    renderAntreanEvents();
  }

  function deleteEvent(id) {
    appState.downtimeEvents = (appState.downtimeEvents || []).filter(e => e.id !== id);
    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast("Event downtime dihapus.");
  }

  function resolveEventGlitch(id) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (!evt) return;

    const pcsCount = getEffectivePcsCount();

    evt.isResolved = true;
    evt.isSensorGlitch = true;
    evt.category = "G";
    evt.kategori = "G";
    evt.detail = "Gagal Cacat";
    evt.details = ["Gagal Cacat"];
    evt.durasiDetik = evt.duration;
    evt.dikerjakanOleh = appState.selectedOperator || "Operator";

    const finalPcs = Array.isArray(evt.pcsKe)
      ? (evt.pcsKe.length === 0 || evt.pcsKe.length === pcsCount ? "Semua" : evt.pcsKe.join(", "))
      : (!evt.pcsKe || evt.pcsKe === "" || evt.pcsKe === "Semua" ? (pcsCount > 1 ? "Semua" : "1") : String(evt.pcsKe));
    evt.pcsKe = finalPcs;

    evt.selected = false;
    evt.problems = [
      {
        kategori: "G",
        details: ["Gagal Cacat"],
        pcsKe: finalPcs
      }
    ];

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast("Event ditandai sebagai Gagal Cacat.");
  }

  function batchResolveSensorGlitch() {
    const unresolved = (appState.downtimeEvents || []).filter(e => !e.isResolved && e.selected);
    if (unresolved.length === 0) {
      showToast("Pilih minimal satu event antrean terlebih dahulu.");
      return;
    }

    const pcsCount = getEffectivePcsCount();

    unresolved.forEach(evt => {
      evt.isResolved = true;
      evt.isSensorGlitch = true;
      evt.category = "G";
      evt.kategori = "G";
      evt.detail = "Gagal Cacat";
      evt.details = ["Gagal Cacat"];
      evt.durasiDetik = evt.duration;
      evt.dikerjakanOleh = appState.selectedOperator || "Operator";

      const finalPcsBatch = Array.isArray(evt.pcsKe)
        ? (evt.pcsKe.length === 0 || evt.pcsKe.length === pcsCount ? "Semua" : evt.pcsKe.join(", "))
        : (!evt.pcsKe || evt.pcsKe === "" || evt.pcsKe === "Semua" ? (pcsCount > 1 ? "Semua" : "1") : String(evt.pcsKe));
      evt.pcsKe = finalPcsBatch;

      evt.selected = false;
      evt.problems = [
        {
          kategori: "G",
          details: ["Gagal Cacat"],
          pcsKe: finalPcsBatch
        }
      ];
    });

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    showToast(`${unresolved.length} event ditandai sebagai Gagal Cacat.`);
  }

  // ── CLASSIFICATION MODAL LOGIC (1:1 DowntimeTracker.tsx) ──

  function openClassifyModal(id) {
    const evt = (appState.downtimeEvents || []).find(e => e.id === id);
    if (!evt) return;

    currentClassifyingEventId = id;
    batchClassifyingEventIds = [];

    const titleEl = document.getElementById("classifyModalTitle");
    if (titleEl) titleEl.textContent = "Klasifikasi Masalah Downtime";
    const lblDur = document.getElementById("lblClassifyDuration");
    if (lblDur) lblDur.textContent = "Durasi:";

    // Durasi Teks
    const durEl = document.getElementById("classifyDurationText");
    if (durEl) durEl.textContent = evt.durationStr || formatDuration(evt.duration || 0);

    const pcsCount = getEffectivePcsCount();
    appState.pcsCount = pcsCount;
    appState.currentPcs = pcsCount;

    // 1. Setup Selected PCS List
    // Aturan Sesuai DowntimeTracker.tsx & Permintaan Pengguna:
    // Jika event unclassified (!evt.isResolved):
    // - Mesin multi-PCS (pcsCount > 1): Default BELUM ada yang dipilih (selectedPcsList = [])
    // - Mesin 1 PCS: otomatis PCS 1 (selectedPcsList = ["1"])
    // Jika event sudah pernah diselesaikan (edit resolved event):
    // - Pakai PCS yang tersimpan jika spesifik (bukan "Semua")
    if (evt.isResolved && evt.pcsKe && evt.pcsKe !== "Semua") {
      if (Array.isArray(evt.pcsKe)) {
        selectedPcsList = evt.pcsKe.map(String);
      } else {
        selectedPcsList = String(evt.pcsKe).split(",").map(s => s.trim()).filter(Boolean);
      }
    } else if (pcsCount === 1) {
      selectedPcsList = ["1"];
    } else {
      // Default beres downtime baru atau klik + Klasifikasi di antrean:
      // Mesin multi-PCS belum dipilih (kosong)
      selectedPcsList = [];
    }

    // 2. Setup Input Meters per PCS
    inputMeters = {};
    customizedPcsKeys = {};
    leaderPcsKey = selectedPcsList[0] || "1";

    const currentMeterAkhir = document.getElementById("inpMeterAkhir")?.value || "";
    let defaultBaseMeter = evt.meter || currentMeterAkhir || "";

    for (let i = 1; i <= pcsCount; i++) {
      const k = String(i);
      let foundVal = "";
      if (evt.meter) {
        const match = String(evt.meter).match(new RegExp(`PCS\\s*${k}:\\s*([^,]+)`, "i"));
        if (match) foundVal = match[1].trim();
        else if (!String(evt.meter).includes("PCS")) foundVal = String(evt.meter).trim();
      }
      inputMeters[k] = foundVal || defaultBaseMeter;
    }

    // 3. Setup Problem Mode State
    problemInputMode = "same";
    activePcsProblemTab = selectedPcsList[0] || "1";
    perPcsProblems = {};
    selectedCategoryIds = [];
    selectedProblemDetails = {};

    const existingProblems = Array.isArray(evt.problems) ? evt.problems : [];
    const hasPerPcs = existingProblems.some(p => p.pcsKe && p.pcsKe !== "Semua" && !String(p.pcsKe).includes(","));

    if (hasPerPcs) {
      problemInputMode = "per_pcs";
      const reconstructed = {};
      const pcsWithProblems = [];

      existingProblems.forEach(p => {
        const pPcs = String(p.pcsKe || "1");
        if (!pcsWithProblems.includes(pPcs)) pcsWithProblems.push(pPcs);
        if (!reconstructed[pPcs]) {
          reconstructed[pPcs] = { categories: [], details: {}, blok: "" };
        }
        if (p.kategori && !reconstructed[pPcs].categories.includes(p.kategori)) {
          reconstructed[pPcs].categories.push(p.kategori);
        }
        if (p.kategori) {
          reconstructed[pPcs].details[p.kategori] = Array.isArray(p.details) ? p.details : (p.details ? [p.details] : (p.detail ? [p.detail] : []));
        }
        if (p.blok) reconstructed[pPcs].blok = p.blok;
      });
      perPcsProblems = reconstructed;
      activePcsProblemTab = pcsWithProblems[0] || selectedPcsList[0] || "1";
    } else if (existingProblems.length > 0) {
      problemInputMode = "same";
      const initialCats = [];
      const initialDets = {};
      existingProblems.forEach(p => {
        if (p.kategori && !initialCats.includes(p.kategori)) initialCats.push(p.kategori);
        if (p.kategori) {
          initialDets[p.kategori] = Array.isArray(p.details) ? p.details : (p.details ? [p.details] : (p.detail ? [p.detail] : []));
        }
      });
      selectedCategoryIds = initialCats;
      selectedProblemDetails = initialDets;
    } else {
      problemInputMode = "same";
      if (evt.category && evt.category !== "G") {
        selectedCategoryIds = [evt.category];
        if (Array.isArray(evt.details)) {
          selectedProblemDetails[evt.category] = [...evt.details];
        } else if (evt.detail) {
          selectedProblemDetails[evt.category] = [evt.detail];
        }
      }
    }

    const btnSame = document.getElementById("btnProblemModeSame");
    const btnPerPcs = document.getElementById("btnProblemModePerPcs");
    const tabBar = document.getElementById("classifyPerPcsTabBar");
    if (problemInputMode === "per_pcs") {
      if (btnSame) btnSame.classList.remove("active");
      if (btnPerPcs) btnPerPcs.classList.add("active");
      if (tabBar) tabBar.style.display = selectedPcsList.length > 1 ? "block" : "none";
    } else {
      if (btnSame) btnSame.classList.add("active");
      if (btnPerPcs) btnPerPcs.classList.remove("active");
      if (tabBar) tabBar.style.display = "none";
    }

    // Blok Setup
    const inpBlok = document.getElementById("classifyInpBlok");
    if (inpBlok) inpBlok.value = evt.blok || "";

    // 4. Update UI Components
    updatePcsUI();
    renderMeterInputs();
    renderPerPcsTabs();
    renderCategoryList();

    const blockBox = document.getElementById("classifyBlockContainer");
    if (blockBox) blockBox.style.display = "block";

    // Show modal
    const modal = document.getElementById("modalClassify");
    if (modal) modal.classList.add("show");
  }

  function openBatchClassifyModal() {
    const events = appState.downtimeEvents || [];
    const selectedEvents = events.filter(e => !e.isResolved && e.selected);

    if (selectedEvents.length === 0) {
      showToast("Pilih minimal satu event antrean terlebih dahulu.");
      return;
    }

    currentClassifyingEventId = null;
    batchClassifyingEventIds = selectedEvents.map(e => e.id);

    const pcsCount = getEffectivePcsCount();
    appState.pcsCount = pcsCount;
    appState.currentPcs = pcsCount;

    // Hitung total durasi
    const totalDurationSec = selectedEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    const durEl = document.getElementById("classifyDurationText");
    if (durEl) durEl.textContent = formatDuration(totalDurationSec);

    const titleEl = document.getElementById("classifyModalTitle");
    if (titleEl) titleEl.textContent = `Klasifikasi Sekaligus (${selectedEvents.length} Event)`;
    const lblDur = document.getElementById("lblClassifyDuration");
    if (lblDur) lblDur.textContent = "Total Durasi:";

    // Sesuai Permintaan Pengguna & DowntimeTracker.tsx:
    // Mesin multi-PCS (pcsCount > 1): Default BELUM ada yang dipilih (kosong)
    // Mesin 1 PCS: otomatis PCS 1
    selectedPcsList = pcsCount > 1 ? [] : ["1"];

    // Setup Input Meters per PCS
    inputMeters = {};
    customizedPcsKeys = {};
    leaderPcsKey = null;

    const currentMeterAkhir = document.getElementById("inpMeterAkhir")?.value || "";
    for (let i = 1; i <= pcsCount; i++) {
      inputMeters[String(i)] = currentMeterAkhir || "";
    }

    // Setup Problem Mode State
    problemInputMode = "same";
    activePcsProblemTab = "1";
    perPcsProblems = {};
    selectedCategoryIds = [];
    selectedProblemDetails = {};

    const inpBlok = document.getElementById("classifyInpBlok");
    if (inpBlok) inpBlok.value = "";

    const btnSame = document.getElementById("btnModeSameProblem");
    const btnPerPcs = document.getElementById("btnModePerPcsProblem");
    const tabBar = document.getElementById("classifyPerPcsTabBar");
    if (btnSame) btnSame.classList.add("active");
    if (btnPerPcs) btnPerPcs.classList.remove("active");
    if (tabBar) tabBar.style.display = "none";

    // Update UI Components
    updatePcsUI();
    renderMeterInputs();
    renderPerPcsTabs();
    renderCategoryList();

    const blockBox = document.getElementById("classifyBlockContainer");
    if (blockBox) blockBox.style.display = "none";

    const modal = document.getElementById("modalClassify");
    if (modal) modal.classList.add("show");
  }

  function closeClassifyModal() {
    const modal = document.getElementById("modalClassify");
    if (modal) modal.classList.remove("show");
    currentClassifyingEventId = null;
    batchClassifyingEventIds = [];
  }

  function updatePcsUI() {
    const pcsBox = document.getElementById("classifyPcsBox");
    const pcsGrid = document.getElementById("classifyPcsButtonGrid");
    const statusText = document.getElementById("classifyPcsStatusText");
    const btnToggleAll = document.getElementById("btnToggleAllPcs");
    const txtToggleAll = document.getElementById("txtToggleAllPcs");
    const pcsModeContainer = document.getElementById("classifyProblemModeContainer");
    const badgeSelected = document.getElementById("badgeSelectedPcsCount");

    const pcsCount = getEffectivePcsCount();

    if (pcsCount > 1 && pcsBox && pcsGrid) {
      pcsBox.style.display = "block";
      pcsGrid.innerHTML = "";

      const isAll = selectedPcsList.length === pcsCount;
      const isNone = selectedPcsList.length === 0;

      if (statusText) {
        if (isAll) statusText.textContent = "Berlaku untuk SEMUA PCS";
        else if (isNone) statusText.textContent = "Belum ada PCS dipilih";
        else statusText.textContent = `${selectedPcsList.length} dari ${pcsCount} PCS dipilih`;
      }

      if (btnToggleAll && txtToggleAll) {
        if (isAll) {
          btnToggleAll.className = "btn-toggle-all-pcs all-selected";
          txtToggleAll.textContent = "Semua PCS";
        } else {
          btnToggleAll.className = "btn-toggle-all-pcs partial";
          txtToggleAll.textContent = "Pilih Semua PCS";
        }
      }

      for (let i = 1; i <= pcsCount; i++) {
        const pcsStr = String(i);
        const isSelected = selectedPcsList.includes(pcsStr);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = `btnClassifyPcs_${pcsStr}`;
        btn.className = `pcs-pill-btn ${isSelected ? "active" : ""}`;
        btn.textContent = `PCS ${pcsStr}`;
        btn.onclick = () => toggleClassifyPcs(pcsStr);
        pcsGrid.appendChild(btn);
      }

      if (pcsModeContainer) {
        pcsModeContainer.style.display = selectedPcsList.length > 1 ? "block" : "none";
      }
      const tabBar = document.getElementById("classifyPerPcsTabBar");
      if (tabBar) {
        tabBar.style.display = (problemInputMode === "per_pcs" && selectedPcsList.length > 1) ? "block" : "none";
      }
      if (badgeSelected) {
        badgeSelected.textContent = `${selectedPcsList.length} PCS Terpilih`;
      }
    } else {
      if (pcsBox) pcsBox.style.display = "none";
      if (pcsModeContainer) pcsModeContainer.style.display = "none";
      const tabBar = document.getElementById("classifyPerPcsTabBar");
      if (tabBar) tabBar.style.display = "none";
      selectedPcsList = ["1"];
    }
  }

  function toggleClassifyPcs(pcsStr) {
    if (selectedPcsList.includes(pcsStr)) {
      selectedPcsList = selectedPcsList.filter(p => p !== pcsStr);
    } else {
      selectedPcsList.push(pcsStr);
      selectedPcsList.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }

    if (!selectedPcsList.includes(activePcsProblemTab) && selectedPcsList.length > 0) {
      activePcsProblemTab = selectedPcsList[0];
    }

    updatePcsUI();
    renderMeterInputs();
    renderPerPcsTabs();
    renderCategoryList();
  }

  function toggleSelectAllClassifyPcs() {
    const pcsCount = getEffectivePcsCount();
    if (selectedPcsList.length === pcsCount) {
      selectedPcsList = [];
    } else {
      selectedPcsList = [];
      for (let i = 1; i <= pcsCount; i++) selectedPcsList.push(String(i));
    }

    if (!selectedPcsList.includes(activePcsProblemTab) && selectedPcsList.length > 0) {
      activePcsProblemTab = selectedPcsList[0];
    }

    updatePcsUI();
    renderMeterInputs();
    renderPerPcsTabs();
    renderCategoryList();
  }

  function renderMeterInputs() {
    const meterBox = document.getElementById("classifyMeterBox");
    const singleContainer = document.getElementById("classifySingleMeterContainer");
    const multiContainer = document.getElementById("classifyMultiMeterContainer");
    const multiGrid = document.getElementById("classifyMultiMeterGrid");
    const btnSync = document.getElementById("btnSyncAllMeters");
    const lblTitle = document.getElementById("txtClassifyMeterLabel");
    const inpSingle = document.getElementById("classifyInpMeterSingle");

    const isMeter = appState.currentMode === "METER" || ["R11", "R12", "R13", "R16", "T2A"].includes((appState.selectedMc || "").toUpperCase());
    if (!isMeter || !meterBox) {
      if (meterBox) meterBox.style.display = "none";
      return;
    }

    meterBox.style.display = "block";
    const pcsCount = getEffectivePcsCount();

    if (pcsCount > 1 && selectedPcsList.length === 0) {
      if (singleContainer) singleContainer.style.display = "none";
      if (multiContainer) multiContainer.style.display = "none";
      if (btnSync) btnSync.style.display = "none";
      if (lblTitle) lblTitle.textContent = "Pilih PCS di atas terlebih dahulu untuk mengisi letak meter";
    } else if (selectedPcsList.length <= 1) {
      // Single PCS Mode
      const singlePcsKey = selectedPcsList[0] || "1";
      if (singleContainer) singleContainer.style.display = "block";
      if (multiContainer) multiContainer.style.display = "none";
      if (btnSync) btnSync.style.display = "none";

      if (lblTitle) {
        lblTitle.textContent = pcsCount > 1 ? `Posisi Letak Meter (PCS ${singlePcsKey})` : "Posisi Letak Titik Meter";
      }

      if (inpSingle) {
        inpSingle.value = inputMeters[singlePcsKey] || "";
        inpSingle.oninput = (e) => {
          inputMeters[singlePcsKey] = e.target.value;
          customizedPcsKeys[singlePcsKey] = true;
        };
      }
    } else {
      // Multi PCS Mode
      if (singleContainer) singleContainer.style.display = "none";
      if (multiContainer) multiContainer.style.display = "block";
      if (btnSync) btnSync.style.display = "inline-flex";

      if (lblTitle) {
        lblTitle.textContent = selectedPcsList.length === pcsCount
          ? "Posisi Letak Meter (Semua PCS)"
          : `Posisi Letak Meter (${selectedPcsList.length} PCS Terpilih)`;
      }

      if (multiGrid) {
        multiGrid.innerHTML = "";
        selectedPcsList.forEach((pcsKey) => {
          const val = inputMeters[pcsKey] || "";
          const isCustom = Boolean(customizedPcsKeys[pcsKey]);
          const isAutoFilled = !isCustom && Boolean(leaderPcsKey) && pcsKey !== leaderPcsKey && Boolean(val);

          const col = document.createElement("div");
          col.style.display = "flex";
          col.style.flexDirection = "column";
          col.style.gap = "6px";
          col.style.padding = "8px 10px";
          col.style.background = "#f8fafc";
          col.style.border = "1px solid #e2e8f0";
          col.style.borderRadius = "12px";

          col.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:11px; font-weight:900; color:#334155;">PCS ${pcsKey}</span>
              ${isCustom ? '<span id="badgeMeterSync_${pcsKey}" class="badge-meter-sync kustom">Kustom</span>' : (isAutoFilled ? '<span id="badgeMeterSync_${pcsKey}" class="badge-meter-sync otomatis">Otomatis</span>' : '<span id="badgeMeterSync_${pcsKey}"></span>')}
            </div>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="text" inputmode="numeric" id="classifyInpMeterPcs_${pcsKey}" value="${val}" placeholder="0" style="width:100%; height:36px; border-radius:8px; border:1px solid ${val ? '#86efac' : '#cbd5e1'}; background:#ffffff; text-align:center; font-weight:800; font-family:monospace; font-size:13px; padding-right:24px;" oninput="DJIDowntime.handlePcsMeterChange('${pcsKey}', this.value)" />
              <span style="position:absolute; right:8px; font-size:10px; font-weight:800; color:#94a3b8; pointer-events:none;">m</span>
            </div>
          `;

          multiGrid.appendChild(col);
        });
      }
    }
  }

  function handlePcsMeterChange(pcsKey, value) {
    inputMeters[pcsKey] = value;
    customizedPcsKeys[pcsKey] = true;

    if (!leaderPcsKey) leaderPcsKey = pcsKey;

    // Auto-sync ke PCS lain yang belum dikustomisasi
    if (pcsKey === leaderPcsKey || Object.keys(customizedPcsKeys).length <= 1) {
      selectedPcsList.forEach((otherKey) => {
        if (otherKey !== pcsKey && !customizedPcsKeys[otherKey]) {
          inputMeters[otherKey] = value;
          const el = document.getElementById(`classifyInpMeterPcs_${otherKey}`);
          if (el) el.value = value;
          const badge = document.getElementById(`badgeMeterSync_${otherKey}`);
          if (badge) {
            badge.textContent = "Otomatis";
            badge.className = "badge-meter-sync otomatis";
          }
        }
      });
    }

    const badgeThis = document.getElementById(`badgeMeterSync_${pcsKey}`);
    if (badgeThis) {
      badgeThis.textContent = "Kustom";
      badgeThis.className = "badge-meter-sync kustom";
    }
  }

  function syncAllMeters() {
    const firstVal = inputMeters[selectedPcsList[0]] || Object.values(inputMeters).find(v => v && v.trim() !== "") || "";
    selectedPcsList.forEach((k) => {
      inputMeters[k] = firstVal;
      customizedPcsKeys[k] = false;
      const el = document.getElementById(`classifyInpMeterPcs_${k}`);
      if (el) el.value = firstVal;
      const badge = document.getElementById(`badgeMeterSync_${k}`);
      if (badge) {
        badge.textContent = "Otomatis";
        badge.className = "badge-meter-sync otomatis";
      }
    });
    showToast("Seluruh meter PCS disamakan: " + (firstVal || "0") + " m");
  }

  function setProblemInputMode(mode) {
    problemInputMode = mode;
    const btnSame = document.getElementById("btnProblemModeSame");
    const btnPerPcs = document.getElementById("btnProblemModePerPcs");
    const tabBar = document.getElementById("classifyPerPcsTabBar");
    const lblCatTitle = document.getElementById("lblClassifyCatTitle");

    if (mode === "per_pcs") {
      if (btnSame) btnSame.classList.remove("active");
      if (btnPerPcs) btnPerPcs.classList.add("active");
      if (tabBar) tabBar.style.display = selectedPcsList.length > 1 ? "block" : "none";

      // Initialize perPcsProblems from selectedCategoryIds & details if not set
      selectedPcsList.forEach((k) => {
        if (!perPcsProblems[k] || (perPcsProblems[k].categories || []).length === 0) {
          perPcsProblems[k] = {
            categories: [...selectedCategoryIds],
            details: JSON.parse(JSON.stringify(selectedProblemDetails)),
            blok: document.getElementById("classifyInpBlok")?.value || ""
          };
        }
      });

      if (!selectedPcsList.includes(activePcsProblemTab) && selectedPcsList.length > 0) {
        activePcsProblemTab = selectedPcsList[0];
      }
    } else {
      if (btnSame) btnSame.classList.add("active");
      if (btnPerPcs) btnPerPcs.classList.remove("active");
      if (tabBar) tabBar.style.display = "none";

      // Jika sebelumnya user sudah memilih masalah di tab aktif per-PCS, sinkronkan ke mode same
      const activePcsData = perPcsProblems[activePcsProblemTab];
      if (activePcsData && activePcsData.categories && activePcsData.categories.length > 0) {
        selectedCategoryIds = [...activePcsData.categories];
        selectedProblemDetails = JSON.parse(JSON.stringify(activePcsData.details || {}));
      }
    }

    // Sync input blok
    const inpBlok = document.getElementById("classifyInpBlok");
    if (inpBlok) {
      if (mode === "per_pcs") {
        inpBlok.value = perPcsProblems[activePcsProblemTab]?.blok || "";
      }
    }

    renderPerPcsTabs();
    renderCategoryList();
  }

  function setActivePcsTab(pcsKey) {
    activePcsProblemTab = pcsKey;

    // Sync input blok
    const inpBlok = document.getElementById("classifyInpBlok");
    if (inpBlok) {
      inpBlok.value = perPcsProblems[pcsKey]?.blok || "";
    }

    renderPerPcsTabs();
    renderCategoryList();
  }

  function renderPerPcsTabs() {
    const tabsList = document.getElementById("classifyPerPcsTabsList");
    if (!tabsList) return;
    tabsList.innerHTML = "";

    selectedPcsList.forEach((pcsKey) => {
      const isActive = activePcsProblemTab === pcsKey;
      const pcsData = perPcsProblems[pcsKey] || { categories: [], details: {} };
      const catCount = (pcsData.categories || []).length;
      const detCount = Object.values(pcsData.details || {}).reduce((sum, d) => sum + (d?.length || 0), 0);

      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = `btn-perpcs-tab ${isActive ? "active" : ""}`;
      tabBtn.onclick = () => setActivePcsTab(pcsKey);

      tabBtn.innerHTML = `
        <span>PCS ${pcsKey}</span>
        <span style="font-size:9.5px; padding:1px 6px; border-radius:9999px; background:${isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}; color:${isActive ? '#ffffff' : '#475569'};">${detCount > 0 ? `${detCount} cacat` : '0'}</span>
      `;

      tabsList.appendChild(tabBtn);
    });
  }

  function handleBlokChange(val) {
    if (problemInputMode === "per_pcs") {
      if (!perPcsProblems[activePcsProblemTab]) {
        perPcsProblems[activePcsProblemTab] = { categories: [], details: {}, blok: "" };
      }
      perPcsProblems[activePcsProblemTab].blok = val;
    }
  }

  function renderCategoryList() {
    const container = document.getElementById("classifyCategoryList");
    const lblCatTitle = document.getElementById("lblClassifyCatTitle");
    if (!container) return;
    container.innerHTML = "";

    if (lblCatTitle) {
      const pcsCount = getEffectivePcsCount();
      if (problemInputMode === "per_pcs" && selectedPcsList.length > 1) {
        lblCatTitle.textContent = `Pilih Kategori Masalah (Khusus PCS ${activePcsProblemTab}):`;
      } else if (selectedPcsList.length === 1 && pcsCount > 1) {
        lblCatTitle.textContent = `Pilih Kategori Masalah (Khusus PCS ${selectedPcsList[0]}):`;
      } else {
        lblCatTitle.textContent = "Pilih Kategori Masalah:";
      }
    }

    const currentCatIds = problemInputMode === "per_pcs"
      ? (perPcsProblems[activePcsProblemTab]?.categories || [])
      : selectedCategoryIds;

    const currentDetailsMap = problemInputMode === "per_pcs"
      ? (perPcsProblems[activePcsProblemTab]?.details || {})
      : selectedProblemDetails;

    const categories = PROBLEM_CATEGORIES || [];
    categories.forEach((cat) => {
      const isSelected = currentCatIds.includes(cat.id);
      const chosenCount = (currentDetailsMap[cat.id] || []).length;

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
            const isItemActive = (currentDetailsMap[cat.id] || []).includes(item);
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
    if (problemInputMode === "per_pcs") {
      if (!perPcsProblems[activePcsProblemTab]) {
        perPcsProblems[activePcsProblemTab] = { categories: [], details: {}, blok: "" };
      }
      const cur = perPcsProblems[activePcsProblemTab];
      if (cur.categories.includes(catId)) {
        cur.categories = cur.categories.filter(id => id !== catId);
        delete cur.details[catId];
      } else {
        cur.categories.push(catId);
      }
      // Sinkronkan ke selectedCategoryIds sebagai backup
      if (selectedPcsList.length <= 1) {
        selectedCategoryIds = [...cur.categories];
        selectedProblemDetails = JSON.parse(JSON.stringify(cur.details));
      }
    } else {
      if (selectedCategoryIds.includes(catId)) {
        selectedCategoryIds = selectedCategoryIds.filter(id => id !== catId);
        delete selectedProblemDetails[catId];
      } else {
        selectedCategoryIds.push(catId);
      }
      // Sinkronkan ke perPcsProblems
      selectedPcsList.forEach((k) => {
        if (!perPcsProblems[k]) perPcsProblems[k] = { categories: [], details: {}, blok: "" };
        perPcsProblems[k].categories = [...selectedCategoryIds];
        perPcsProblems[k].details = JSON.parse(JSON.stringify(selectedProblemDetails));
      });
    }
    renderCategoryList();
    renderPerPcsTabs();
  }

  function toggleProblemDetail(catId, itemName) {
    if (problemInputMode === "per_pcs") {
      if (!perPcsProblems[activePcsProblemTab]) {
        perPcsProblems[activePcsProblemTab] = { categories: [], details: {}, blok: "" };
      }
      const cur = perPcsProblems[activePcsProblemTab];
      if (!cur.details[catId]) cur.details[catId] = [];
      if (cur.details[catId].includes(itemName)) {
        cur.details[catId] = cur.details[catId].filter(x => x !== itemName);
      } else {
        cur.details[catId].push(itemName);
      }
      if (!cur.categories.includes(catId)) cur.categories.push(catId);
      // Sinkronkan ke selectedProblemDetails sebagai backup
      if (selectedPcsList.length <= 1) {
        selectedCategoryIds = [...cur.categories];
        selectedProblemDetails = JSON.parse(JSON.stringify(cur.details));
      }
    } else {
      if (!selectedProblemDetails[catId]) selectedProblemDetails[catId] = [];
      if (selectedProblemDetails[catId].includes(itemName)) {
        selectedProblemDetails[catId] = selectedProblemDetails[catId].filter(x => x !== itemName);
      } else {
        selectedProblemDetails[catId].push(itemName);
      }
      if (!selectedCategoryIds.includes(catId)) selectedCategoryIds.push(catId);
      // Sinkronkan ke perPcsProblems
      selectedPcsList.forEach((k) => {
        if (!perPcsProblems[k]) perPcsProblems[k] = { categories: [], details: {}, blok: "" };
        perPcsProblems[k].categories = [...selectedCategoryIds];
        perPcsProblems[k].details = JSON.parse(JSON.stringify(selectedProblemDetails));
      });
    }
    renderCategoryList();
    renderPerPcsTabs();
  }

  function saveClassifyAsGagalCacat() {
    if (!currentClassifyingEventId && batchClassifyingEventIds.length === 0) return;

    const pcsCount = getEffectivePcsCount();

    // Khusus GAGAL CACAT: Default SEMUA PCS otomatis terpilih jika belum ada yang dipilih
    if (pcsCount > 1 && selectedPcsList.length === 0) {
      selectedPcsList = [];
      for (let i = 1; i <= pcsCount; i++) selectedPcsList.push(String(i));
    }

    const isMeter = appState.currentMode === "METER" || ["R11", "R12", "R13", "R16", "T2A"].includes((appState.selectedMc || "").toUpperCase());
    let meterStr = null;

    if (isMeter) {
      if (selectedPcsList.length <= 1) {
        const singlePcsKey = selectedPcsList[0] || "1";
        const singleVal = document.getElementById("classifyInpMeterSingle")?.value.trim() || inputMeters[singlePcsKey] || "";
        meterStr = singleVal || null;
      } else {
        meterStr = selectedPcsList
          .map(k => `PCS ${k}: ${inputMeters[k] || ''}`)
          .join(", ");
      }
    }

    const pcsKeStr = selectedPcsList.length === pcsCount ? "Semua" : (selectedPcsList.join(", ") || "Semua");
    const targetOperator = appState.selectedOperator || "Operator";

    if (batchClassifyingEventIds.length > 0) {
      const targetIds = [...batchClassifyingEventIds];
      (appState.downtimeEvents || []).forEach(evt => {
        if (targetIds.includes(evt.id)) {
          evt.category = "G";
          evt.kategori = "G";
          evt.detail = "Gagal Cacat";
          evt.details = ["Gagal Cacat"];
          evt.blok = null;
          evt.meter = meterStr;
          evt.durasiDetik = evt.duration;
          evt.dikerjakanOleh = targetOperator;
          evt.pcsKe = pcsKeStr;
          evt.isResolved = true;
          evt.isSensorGlitch = true;
          evt.selected = false;
          evt.problems = [
            {
              kategori: "G",
              details: ["Gagal Cacat"],
              blok: undefined,
              meter: meterStr || undefined,
              pcsKe: pcsKeStr
            }
          ];
        }
      });
      showToast(`${targetIds.length} downtime disimpan sebagai Gagal Cacat.`);
    } else if (currentClassifyingEventId) {
      const evt = (appState.downtimeEvents || []).find(e => e.id === currentClassifyingEventId);
      if (evt) {
        evt.category = "G";
        evt.kategori = "G";
        evt.detail = "Gagal Cacat";
        evt.details = ["Gagal Cacat"];
        evt.blok = null;
        evt.meter = meterStr;
        evt.durasiDetik = evt.duration;
        evt.dikerjakanOleh = targetOperator;
        evt.pcsKe = pcsKeStr;
        evt.isResolved = true;
        evt.isSensorGlitch = true;
        evt.selected = false;
        evt.problems = [
          {
            kategori: "G",
            details: ["Gagal Cacat"],
            blok: undefined,
            meter: meterStr || undefined,
            pcsKe: pcsKeStr
          }
        ];
        showToast("Downtime disimpan sebagai Gagal Cacat.");
      }
    }

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    closeClassifyModal();
  }

  function saveClassifyProblems() {
    if (!currentClassifyingEventId && batchClassifyingEventIds.length === 0) return;

    const pcsCount = getEffectivePcsCount();

    // 1. Validasi PCS
    if (pcsCount > 1 && selectedPcsList.length === 0) {
      alert("Pilih minimal 1 PCS yang mengalami masalah!");
      return;
    }

    // 2. Validasi Meter jika mode meter
    const isMeter = appState.currentMode === "METER" || ["R11", "R12", "R13", "R16", "T2A"].includes((appState.selectedMc || "").toUpperCase());
    if (isMeter) {
      if (selectedPcsList.length <= 1) {
        const singlePcsKey = selectedPcsList[0] || "1";
        const singleVal = document.getElementById("classifyInpMeterSingle")?.value.trim() || inputMeters[singlePcsKey] || "";
        if (!singleVal) {
          alert(`Posisi letak meter untuk PCS ${singlePcsKey} belum diisi!`);
          document.getElementById("classifyInpMeterSingle")?.focus();
          return;
        }
        inputMeters[singlePcsKey] = singleVal;
      } else {
        const missingKey = selectedPcsList.find(k => !inputMeters[k] || inputMeters[k].trim() === "");
        if (missingKey) {
          alert(`Nilai meter untuk PCS ${missingKey} belum diisi!`);
          document.getElementById(`classifyInpMeterPcs_${missingKey}`)?.focus();
          return;
        }
      }
    }

    let problems = [];
    const pcsKeStr = selectedPcsList.length === pcsCount ? "Semua" : (selectedPcsList.join(", ") || "Semua");

    const isPerPcsMode = problemInputMode === "per_pcs";

    if (isPerPcsMode) {
      // Per-PCS Mode
      let hasAnyProblem = false;
      const missingPcsKeys = [];

      selectedPcsList.forEach((pcsKey) => {
        let pcsData = perPcsProblems[pcsKey];
        // Smart fallback: jika perPcsProblems untuk pcsKey ini belum terisi, coba cek selectedCategoryIds atau tab aktif
        if (!pcsData || !pcsData.categories || pcsData.categories.length === 0) {
          if (pcsKey === activePcsProblemTab && selectedCategoryIds.length > 0) {
            pcsData = {
              categories: [...selectedCategoryIds],
              details: JSON.parse(JSON.stringify(selectedProblemDetails)),
              blok: document.getElementById("classifyInpBlok")?.value || ""
            };
          }
        }

        const pcsMeterVal = selectedPcsList.length <= 1
          ? (document.getElementById("classifyInpMeterSingle")?.value.trim() || inputMeters[pcsKey] || "")
          : (inputMeters[pcsKey] || "");

        let pcsHasProblem = false;
        if (pcsData && Array.isArray(pcsData.categories)) {
          pcsData.categories.forEach((catId) => {
            const details = [...(pcsData.details?.[catId] || [])];
            if (details.length > 0) {
              pcsHasProblem = true;
              hasAnyProblem = true;
              problems.push({
                kategori: catId,
                details: details,
                blok: pcsData.blok?.trim() || undefined,
                meter: pcsMeterVal || undefined,
                pcsKe: pcsKey
              });
            }
          });
        }

        if (!pcsHasProblem) {
          missingPcsKeys.push(pcsKey);
        }
      });

      // Fallback global jika semua perPcsProblems kosong tapi selectedCategoryIds terisi
      if (!hasAnyProblem && selectedCategoryIds.length > 0) {
        const inpBlok = document.getElementById("classifyInpBlok");
        const blokVal = inpBlok ? inpBlok.value.trim() : null;
        const meterStr = selectedPcsList.length <= 1
          ? (document.getElementById("classifyInpMeterSingle")?.value.trim() || inputMeters[selectedPcsList[0]] || null)
          : selectedPcsList.map(k => `PCS ${k}: ${inputMeters[k] || ''}`).join(", ");

        problems = selectedCategoryIds.map((catId) => ({
          kategori: catId,
          details: selectedProblemDetails[catId] || [],
          blok: blokVal || undefined,
          meter: meterStr || undefined,
          pcsKe: pcsKeStr
        }));
        hasAnyProblem = problems.some(p => p.details && p.details.length > 0);
      }

      if (!hasAnyProblem || problems.length === 0) {
        alert("Pilih minimal 1 kategori dan 1 detail masalah sebelum menyimpan!");
        return;
      }

      // Jika lebih dari 1 PCS dipilih tapi ada PCS yang belum diisi masalahnya:
      if (selectedPcsList.length > 1 && missingPcsKeys.length > 0) {
        const firstMissing = missingPcsKeys[0];
        alert(`Pilih minimal 1 kategori dan detail masalah untuk PCS ${firstMissing}!`);
        setActivePcsTab(firstMissing);
        return;
      }
    } else {
      // Same across all PCS
      const allChosenDetails = [];
      let primaryCat = null;

      selectedCategoryIds.forEach((catId) => {
        const items = selectedProblemDetails[catId] || [];
        if (items.length > 0) {
          if (!primaryCat) primaryCat = catId;
          items.forEach(it => allChosenDetails.push(it));
        }
      });

      // Fallback ke tab aktif perPcs jika selectedCategoryIds kosong
      if ((!primaryCat || allChosenDetails.length === 0) && perPcsProblems[activePcsProblemTab]) {
        const fallbackPcs = perPcsProblems[activePcsProblemTab];
        (fallbackPcs.categories || []).forEach((catId) => {
          const items = fallbackPcs.details?.[catId] || [];
          if (items.length > 0) {
            if (!primaryCat) primaryCat = catId;
            items.forEach(it => allChosenDetails.push(it));
          }
        });
        if (primaryCat && allChosenDetails.length > 0) {
          selectedCategoryIds = [...(fallbackPcs.categories || [])];
          selectedProblemDetails = JSON.parse(JSON.stringify(fallbackPcs.details || {}));
        }
      }

      if (!primaryCat || allChosenDetails.length === 0) {
        alert("Pilih minimal 1 kategori dan 1 detail masalah sebelum menyimpan!");
        return;
      }

      const inpBlok = document.getElementById("classifyInpBlok");
      const blokVal = inpBlok ? inpBlok.value.trim() : null;

      const meterStr = selectedPcsList.length <= 1
        ? (document.getElementById("classifyInpMeterSingle")?.value.trim() || inputMeters[selectedPcsList[0]] || null)
        : selectedPcsList.map(k => `PCS ${k}: ${inputMeters[k] || ''}`).join(", ");

      problems = selectedCategoryIds.map((catId) => {
        return {
          kategori: catId,
          details: selectedProblemDetails[catId] || [],
          blok: blokVal || undefined,
          meter: meterStr || undefined,
          pcsKe: pcsKeStr
        };
      });
    }

    // Set first problem as primary info for card
    const p0 = problems[0] || {};
    const primaryCategory = p0.kategori || "A";
    const primaryDetail = (p0.details || []).join(", ");
    const primaryDetails = p0.details || [];
    const primaryBlok = p0.blok || null;
    const primaryMeter = p0.meter || null;
    const targetOperator = appState.selectedOperator || "Operator";

    if (batchClassifyingEventIds.length > 0) {
      const targetIds = [...batchClassifyingEventIds];
      (appState.downtimeEvents || []).forEach(evt => {
        if (targetIds.includes(evt.id)) {
          evt.category = primaryCategory;
          evt.kategori = primaryCategory;
          evt.detail = primaryDetail;
          evt.details = primaryDetails;
          evt.blok = primaryBlok;
          evt.meter = primaryMeter;
          evt.durasiDetik = evt.duration;
          evt.dikerjakanOleh = targetOperator;
          evt.pcsKe = pcsKeStr;
          evt.isResolved = true;
          evt.isSensorGlitch = false;
          evt.selected = false;
          evt.problems = JSON.parse(JSON.stringify(problems));
        }
      });
      showToast(`${targetIds.length} event berhasil diklasifikasi!`);
    } else if (currentClassifyingEventId) {
      const evt = (appState.downtimeEvents || []).find(e => e.id === currentClassifyingEventId);
      if (evt) {
        evt.category = primaryCategory;
        evt.kategori = primaryCategory;
        evt.detail = primaryDetail;
        evt.details = primaryDetails;
        evt.blok = primaryBlok;
        evt.meter = primaryMeter;
        evt.durasiDetik = evt.duration;
        evt.dikerjakanOleh = targetOperator;
        evt.pcsKe = pcsKeStr;
        evt.isResolved = true;
        evt.isSensorGlitch = false;
        evt.selected = false;
        evt.problems = JSON.parse(JSON.stringify(problems));
        showToast("Klasifikasi masalah berhasil disimpan!");
      }
    }

    localStorage.setItem(KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));
    syncDowntimeToDraftPanel();
    updateTotalDowntimeDisplay();
    renderAntreanEvents();
    closeClassifyModal();
  }

  window.DJIDowntime = {
    isTimerRunning,
    restoreActiveTimerIfNeeded,
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
    openBatchClassifyModal,
    closeClassifyModal,
    toggleClassifyPcs,
    toggleSelectAllClassifyPcs,
    handlePcsMeterChange,
    syncAllMeters,
    setProblemInputMode,
    setActivePcsTab,
    handleBlokChange,
    saveClassifyAsGagalCacat,
    saveClassifyProblems,
    resetAllDowntime
  };
})(window);
