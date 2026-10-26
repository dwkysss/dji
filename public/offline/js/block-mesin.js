/**
 * Block Mesin (Multi-shift Machine Lock / Maintenance)
 * Matches DowntimeTracker.tsx 1:1
 * Dentelle Jaya Infinitex - Offline Portal
 */

(function (window) {
  "use strict";

  const { formatDuration, showToast } = window.DJIConfig;
  const { appState } = window.DJIState;

  let blockLiveInterval = null;
  let blockLiveSeconds = 0;
  let showBlockInfo = false;

  function getBlockStorageKey() {
    return `dji_machine_block_${appState.selectedMc || "R1"}`;
  }

  function getActiveBlock() {
    try {
      const saved = localStorage.getItem(getBlockStorageKey());
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  function checkActiveBlock() {
    const active = getActiveBlock();
    appState.activeBlock = active;

    if (blockLiveInterval) {
      clearInterval(blockLiveInterval);
      blockLiveInterval = null;
    }

    if (active && active.startTime) {
      blockLiveSeconds = Math.max(0, Math.floor((Date.now() - active.startTime) / 1000));
      blockLiveInterval = setInterval(() => {
        blockLiveSeconds++;
        const el = document.getElementById("txtBlockLiveTimer");
        if (el) el.textContent = formatDuration(blockLiveSeconds);

        // Heartbeat offline update per jam
        if (active && active.isAutoBlocked) {
          const curHour = Math.floor(blockLiveSeconds / 3600);
          const lastHour = active.lastHeartbeatHour || 1;
          if (curHour > lastHour) {
            active.lastHeartbeatHour = curHour;
            localStorage.setItem(getBlockStorageKey(), JSON.stringify(active));
          }
        }
      }, 1000);
    } else {
      blockLiveSeconds = 0;
    }

    renderBlockCard();
  }

  function toggleInfo() {
    showBlockInfo = !showBlockInfo;
    const box = document.getElementById("boxBlockInfoNote");
    if (box) {
      box.style.display = showBlockInfo ? "flex" : "none";
    }
  }

  function renderBlockCard() {
    const container = document.getElementById("boxBlockMesinCard");
    if (!container) return;

    const active = appState.activeBlock;

    if (!active) {
      // ── NORMAL STATE (NOT BLOCKED) ──
      container.className = "block-mesin-box";
      container.innerHTML = `
        <div class="block-mesin-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="block-icon-square">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div class="block-title-text">
              <span>BLOCK MESIN</span>
              <button type="button" onclick="DJIBlockMesin.toggleInfo()" style="border:none; background:none; cursor:pointer; color:#0284c7; padding:2px;" title="Info Block">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </div>
          </div>
          <span class="badge-stop-pill">Mesin Stop</span>
        </div>

        <div id="boxBlockInfoNote" style="display:${showBlockInfo ? 'flex' : 'none'}; margin-top:10px; padding:10px 12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; font-size:11px; color:#0369a1; align-items:start; gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="shrink-0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span style="flex:1; line-height:1.4;">Untuk perbaikan berat / mesin mati total lintas shift (tanpa produksi kain).</span>
          <button type="button" onclick="DJIBlockMesin.toggleInfo()" style="background:none; border:none; cursor:pointer; color:#0284c7; padding:0;">&times;</button>
        </div>

        <button type="button" class="btn-block-mesin-real" onclick="DJIBlockMesin.initiateBlockMachine()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>BLOCK MESIN</span>
        </button>
      `;
    } else {
      // ── ACTIVE BLOCKED STATE (DALAM PERBAIKAN) ──
      container.className = "block-mesin-box blocked";
      
      const logs = active.handoffLogs || [];
      let logsHtml = "";
      if (logs.length > 1) {
        logsHtml = `
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:8px 10px; max-height:85px; overflow-y:auto; margin-top:8px; display:flex; flex-direction:column; gap:4px;">
            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">Riwayat Serah Terima (${logs.length}):</div>
            ${logs.map((log) => `
              <div style="font-size:10px; padding:3px 6px; background:#f8fafc; border-radius:6px; border:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:#334155;">${log.operatorName} (${log.shift})</span>
                <span style="font-size:9px; color:#94a3b8;">${log.timestamp} • ${log.notes || ''}</span>
              </div>
            `).join("")}
          </div>
        `;
      }

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <!-- Top Row Active Header -->
          <div style="display:flex; align-items:start; justify-content:space-between; gap:10px;">
            <div style="display:flex; align-items:start; gap:8px;">
              <div style="width:34px; height:34px; border-radius:10px; background:#1e293b; color:#fbbf24; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <h4 style="font-size:12px; font-weight:900; color:#1e293b; margin:0; text-transform:uppercase;">Mesin Diblok (Dalam Perbaikan)</h4>
                  ${active.isAutoBlocked ? `<span style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px; border-radius:999px; font-size:8.5px; font-weight:900; text-transform:uppercase; background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">Auto-Block 1 Jam</span>` : ""}
                </div>
                <p style="font-size:10px; font-weight:600; color:#64748b; margin:2px 0 0 0;">
                  Mulai ${active.startDateStr} pkl ${active.startTimeStr} • Pelapor: <strong style="color:#0f172a;">${active.initialReporter}</strong>
                </p>
              </div>
            </div>
            <div style="text-align:right; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:4px 8px; flex-shrink:0;">
              <span style="font-size:8px; font-weight:900; color:#64748b; text-transform:uppercase; display:block;">Total Stop:</span>
              <span id="txtBlockLiveTimer" style="font-size:13px; font-weight:900; font-family:monospace; color:#b45309;">${formatDuration(blockLiveSeconds)}</span>
            </div>
          </div>

          ${active.isAutoBlocked ? `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:8px 10px; font-size:10px; color:#92400e; line-height:1.4;">
              <strong>Auto-Block Aktif:</strong> Mesin otomatis diblokir karena mati &gt; 1 jam. Saat perbaikan selesai, tekan <strong>UNBLOCK MESIN</strong> untuk mengisi penyebab kerusakan aktual.
            </div>
          ` : ""}

          ${logsHtml}

          <!-- Actions Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;">
            <button type="button" onclick="DJIBlockMesin.openProgressModal()" style="height:36px; border-radius:10px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Catat Progres</span>
            </button>
            <button type="button" onclick="DJIBlockMesin.openHandoffModal()" style="height:36px; border-radius:10px; border:1px solid #bae6fd; background:#f0f9ff; color:#0369a1; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Serah Terima</span>
            </button>
          </div>

          <button type="button" onclick="DJIBlockMesin.initiateUnblockMachine()" style="width:100%; height:40px; border-radius:12px; background:#16a34a; border:none; color:#ffffff; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 3px 10px rgba(22, 163, 74, 0.25);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>UNBLOCK MESIN</span>
          </button>

          <div style="text-align:center;">
            <button type="button" onclick="DJIBlockMesin.initiateCancelBlock()" style="background:none; border:none; color:#ef4444; font-size:10px; font-weight:800; cursor:pointer; padding:2px;">
              Batalkan Block (Reset)
            </button>
          </div>
        </div>
      `;
    }
  }

  function initiateBlockMachine() {
    const mc = appState.selectedMc || "R1";
    const modal = document.getElementById("modalConfirmBlock");
    const labelMc = document.getElementById("confirmBlockMcName");
    if (labelMc) labelMc.textContent = `Mesin ${mc}`;
    if (modal) modal.classList.add("show");
  }

  function closeConfirmBlockModal() {
    const modal = document.getElementById("modalConfirmBlock");
    if (modal) modal.classList.remove("show");
  }

  function confirmExecuteBlock() {
    const now = Date.now();
    const isoDate = new Date().toISOString().split("T")[0];
    const mc = appState.selectedMc || "R1";

    // 1. Matikan normal timer downtime jika sedang jalan
    if (window.DJIDowntime && window.DJIDowntime.cancelDowntimeTimer) {
      window.DJIDowntime.cancelDowntimeTimer();
    }

    const newBlock = {
      id: `block-${now}`,
      nomorMc: mc,
      startTime: now,
      startTimeStr: new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      startDateStr: new Date(now).toLocaleDateString("id-ID"),
      dateIso: isoDate,
      initialReporter: appState.selectedOperator || "Operator",
      shift: appState.selectedGroup || "A",
      handoffLogs: [
        {
          id: `log-${now}`,
          startTime: now,
          operatorName: appState.selectedOperator || "Operator Aktif",
          shift: appState.selectedGroup || "A",
          timestamp: new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          dateStr: new Date(now).toLocaleDateString("id-ID"),
          notes: "Mulai Memblokir Mesin (Perbaikan Berlangsung)"
        }
      ]
    };

    localStorage.setItem(getBlockStorageKey(), JSON.stringify(newBlock));
    closeConfirmBlockModal();
    checkActiveBlock();
    showToast(`Mesin ${mc} berhasil diblokir (status perbaikan).`);
  }

  function initiateCancelBlock() {
    const modal = document.getElementById("modalConfirmCancelBlock");
    if (modal) modal.classList.add("show");
  }

  function closeCancelBlockModal() {
    const modal = document.getElementById("modalConfirmCancelBlock");
    if (modal) modal.classList.remove("show");
  }

  function confirmExecuteCancelBlock() {
    localStorage.removeItem(getBlockStorageKey());
    closeCancelBlockModal();
    checkActiveBlock();
    showToast("Block mesin berhasil dibatalkan.");
  }

  function openProgressModal() {
    const modal = document.getElementById("modalBlockProgress");
    const inp = document.getElementById("inpBlockProgressNote");
    if (inp) inp.value = "";
    if (modal) modal.classList.add("show");
  }

  function closeProgressModal() {
    const modal = document.getElementById("modalBlockProgress");
    if (modal) modal.classList.remove("show");
  }

  function saveProgress() {
    const inp = document.getElementById("inpBlockProgressNote");
    const noteText = inp ? inp.value.trim() : "";
    if (!noteText) {
      alert("Catatan progres wajib diisi!");
      return;
    }

    const active = getActiveBlock();
    if (!active) return;

    const now = Date.now();
    const newLog = {
      id: `log-${now}`,
      startTime: now,
      operatorName: appState.selectedOperator || "Operator",
      shift: appState.selectedGroup || "A",
      timestamp: new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      dateStr: new Date(now).toLocaleDateString("id-ID"),
      notes: noteText
    };

    active.handoffLogs = [...(active.handoffLogs || []), newLog];
    localStorage.setItem(getBlockStorageKey(), JSON.stringify(active));

    closeProgressModal();
    checkActiveBlock();
    showToast("Catatan progres perbaikan berhasil disimpan!");
  }

  function openHandoffModal() {
    const modal = document.getElementById("modalBlockHandoff");
    const sel = document.getElementById("selBlockHandoffOperator");
    if (sel) {
      sel.innerHTML = "";
      const operators = (appState.bootstrap && appState.bootstrap.operators) ? appState.bootstrap.operators : [];
      const currentOp = appState.selectedOperator || "";

      if (currentOp) {
        const opt = document.createElement("option");
        opt.value = currentOp;
        opt.textContent = `${currentOp} (Operator Aktif)`;
        sel.appendChild(opt);
      }

      operators
        .filter(o => o.name !== currentOp)
        .forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.name;
          opt.textContent = `${o.name} (Shift ${o.shift || '-'})`;
          sel.appendChild(opt);
        });
    }

    if (modal) modal.classList.add("show");
  }

  function closeHandoffModal() {
    const modal = document.getElementById("modalBlockHandoff");
    if (modal) modal.classList.remove("show");
  }

  function saveHandoff() {
    const sel = document.getElementById("selBlockHandoffOperator");
    const targetOp = sel ? sel.value : "";
    if (!targetOp) return;

    const active = getActiveBlock();
    if (!active) return;

    const now = Date.now();
    const newLog = {
      id: `log-${now}`,
      startTime: now,
      operatorName: targetOp,
      shift: appState.selectedGroup || "A",
      timestamp: new Date(now).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      dateStr: new Date(now).toLocaleDateString("id-ID"),
      notes: `Serah terima shift ke ${targetOp}`
    };

    active.handoffLogs = [...(active.handoffLogs || []), newLog];
    localStorage.setItem(getBlockStorageKey(), JSON.stringify(active));

    // Update active operator
    appState.selectedOperator = targetOp;
    if (window.DJIState && window.DJIState.applyHeaderToCards) {
      window.DJIState.applyHeaderToCards();
    }

    closeHandoffModal();
    checkActiveBlock();
    showToast(`Serah terima shift ke ${targetOp} berhasil disimpan.`);
  }

  function initiateUnblockMachine() {
    const active = getActiveBlock();
    if (!active) return;

    const totalSec = Math.max(1, Math.floor((Date.now() - active.startTime) / 1000));
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // Buat event downtime perbaikan khusus
    const newEvt = {
      id: "evt_block_" + Date.now(),
      duration: totalSec,
      durasiDetik: totalSec,
      durationStr: formatDuration(totalSec),
      timestamp: timeStr,
      selected: false,
      category: "F",
      kategori: "F",
      detail: "Perbaikan Mesin (Block)",
      details: ["Perbaikan Mesin (Block)"],
      blok: null,
      pcsKe: appState.pcsCount > 1 ? "Semua" : "1",
      meter: null,
      dikerjakanOleh: "Perbaikan Khusus (" + (active.initialReporter || "Teknisi") + ")",
      isResolved: false,
      isSensorGlitch: false,
      problems: [
        {
          kategori: "F",
          details: ["Perbaikan Mesin (Block)"],
          pcsKe: appState.pcsCount > 1 ? "Semua" : "1"
        }
      ]
    };

    if (!appState.downtimeEvents) appState.downtimeEvents = [];
    appState.downtimeEvents.push(newEvt);
    localStorage.setItem(window.DJIConfig.KEYS.DOWNTIME, JSON.stringify(appState.downtimeEvents));

    // Bersihkan status block
    localStorage.removeItem(getBlockStorageKey());
    appState.activeBlock = null;

    if (blockLiveInterval) {
      clearInterval(blockLiveInterval);
      blockLiveInterval = null;
    }

    renderBlockCard();

    if (window.DJIDowntime) {
      window.DJIDowntime.updateTotalDowntimeDisplay();
      window.DJIDowntime.renderAntreanEvents();
      // Buka modal klasifikasi agar operator/teknisi bisa memilih detail masalah spesifik
      window.DJIDowntime.openClassifyModal(newEvt.id);
    }

    showToast(`Mesin berhasil di-unblock! Durasi ${newEvt.durationStr} dialihkan ke downtime.`);
  }

  function executeAutoBlockOffline(durationSec) {
    if (appState.activeBlock) return;
    const now = Date.now();
    const isoDate = new Date().toISOString().split("T")[0];
    const mc = appState.selectedMc || "R1";

    if (window.DJIDowntime && window.DJIDowntime.cancelDowntimeTimer) {
      window.DJIDowntime.cancelDowntimeTimer();
    }

    const dur = durationSec || 3600;
    const startTimeMs = now - (dur * 1000);

    const newBlock = {
      id: `block-${now}`,
      nomorMc: mc,
      startTime: startTimeMs,
      startTimeStr: new Date(startTimeMs).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      startDateStr: new Date(startTimeMs).toLocaleDateString("id-ID"),
      dateIso: isoDate,
      initialReporter: appState.selectedOperator || "Operator",
      shift: appState.selectedGroup || "A",
      isAutoBlocked: true,
      handoffLogs: [
        {
          id: `log-${now}`,
          startTime: startTimeMs,
          operatorName: appState.selectedOperator || "Operator Aktif",
          shift: appState.selectedGroup || "A",
          timestamp: new Date(startTimeMs).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          dateStr: new Date(startTimeMs).toLocaleDateString("id-ID"),
          notes: "Auto-Block: Mesin berhenti > 1 jam tanpa input operator (Dalam Perbaikan)"
        }
      ]
    };

    localStorage.setItem(getBlockStorageKey(), JSON.stringify(newBlock));
    checkActiveBlock();
    showToast(`Mesin ${mc} otomatis dialihkan ke status Block Mesin (> 1 jam mati).`);
  }

  window.DJIBlockMesin = {
    checkActiveBlock,
    toggleInfo,
    initiateBlockMachine,
    closeConfirmBlockModal,
    confirmExecuteBlock,
    initiateCancelBlock,
    closeCancelBlockModal,
    confirmExecuteCancelBlock,
    openProgressModal,
    closeProgressModal,
    saveProgress,
    openHandoffModal,
    closeHandoffModal,
    saveHandoff,
    initiateUnblockMachine,
    executeAutoBlockOffline
  };
})(window);
