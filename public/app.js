// Progressive Context — Frame Builder
// Client-side logic for grabbing frames, drawing templates, and extracting regions via OCR.

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Global State
  // ---------------------------------------------------------------------------

  const state = {
    frames: [],          // { canvas, dataUrl, name }
    templates: {},       // { templateName: { frameIdx, rects: [{x,y,w,h}] } }
    results: [],         // { name, dataUrl, region }
    currentStep: 1
  };

  // Temporary drawing state for Step 2
  let currentRects = [];
  let drawing = false;
  let drawStart = { x: 0, y: 0 };

  // ---------------------------------------------------------------------------
  // Utility Functions
  // ---------------------------------------------------------------------------

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function cleanFilename(name) {
    return name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') || 'unknown';
  }

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // ---------------------------------------------------------------------------
  // Step Navigation
  // ---------------------------------------------------------------------------

  const stepBtns = $$('.step-btn');
  const panels = { 1: $('#step-1'), 2: $('#step-2'), 3: $('#step-3') };

  function goToStep(n) {
    // Guard: step 2 requires frames, step 3 requires templates
    if (n === 2 && state.frames.length === 0) return;
    if (n === 3 && Object.keys(state.templates).length === 0) return;

    state.currentStep = n;

    // Toggle panels
    Object.entries(panels).forEach(([key, el]) => {
      el.style.display = Number(key) === n ? '' : 'none';
    });

    // Update nav active state
    stepBtns.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.step) === n);
    });

    // Run per-step setup when entering
    if (n === 2) setupStep2();
    if (n === 3) setupStep3();
  }

  stepBtns.forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.step)));
  });

  $$('.next-btn').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.next)));
  });

  $$('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.prev)));
  });

  // ---------------------------------------------------------------------------
  // Step 1: Frame Grabber
  // ---------------------------------------------------------------------------

  const dropZone = $('#drop-zone');
  const videoInput = $('#video-input');
  const videoWorkspace = $('#video-workspace');
  const videoEl = $('#video-el');
  const frameCanvas = $('#frame-canvas');
  const playBtn = $('#play-btn');
  const scrubBar = $('#scrub-bar');
  const timeDisplay = $('#time-display');
  const grabBtn = $('#grab-btn');
  const stepBackBtn = $('#step-back-btn');
  const stepFwdBtn = $('#step-fwd-btn');
  const grabCount = $('#grab-count');
  const grabbedFrames = $('#grabbed-frames');
  const toStep2 = $('#to-step-2');
  const videoTitle = $('#video-title');

  // Load video from file
  function loadVideo(file) {
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoTitle.textContent = file.name;

    videoEl.addEventListener('loadedmetadata', function onMeta() {
      videoEl.removeEventListener('loadedmetadata', onMeta);
      frameCanvas.width = videoEl.videoWidth;
      frameCanvas.height = videoEl.videoHeight;
      dropZone.style.display = 'none';
      videoWorkspace.style.display = '';
      updateTimeDisplay();
    });
  }

  // File input handler
  videoInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadVideo(e.target.files[0]);
  });

  // Drag-and-drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) loadVideo(file);
  });

  // Play / pause
  playBtn.addEventListener('click', togglePlay);
  function togglePlay() {
    if (videoEl.paused) {
      videoEl.play();
      playBtn.innerHTML = '&#9646;&#9646;';
    } else {
      videoEl.pause();
      playBtn.innerHTML = '&#9654;';
    }
  }

  // Time display updater
  function updateTimeDisplay() {
    const cur = formatTime(videoEl.currentTime);
    const dur = formatTime(videoEl.duration || 0);
    timeDisplay.textContent = `${cur} / ${dur}`;
    if (!videoEl.paused) {
      scrubBar.value = (videoEl.currentTime / videoEl.duration) * 1000;
    }
  }
  videoEl.addEventListener('timeupdate', updateTimeDisplay);
  videoEl.addEventListener('ended', () => { playBtn.innerHTML = '&#9654;'; });

  // Scrub bar
  scrubBar.addEventListener('input', () => {
    const ratio = scrubBar.value / 1000;
    videoEl.currentTime = ratio * videoEl.duration;
  });

  // Step seek buttons
  stepBackBtn.addEventListener('click', () => {
    videoEl.currentTime = Math.max(0, videoEl.currentTime - 1);
  });
  stepFwdBtn.addEventListener('click', () => {
    videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 1);
  });

  // Grab frame
  grabBtn.addEventListener('click', grabFrame);
  function grabFrame() {
    if (!videoEl.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const idx = state.frames.length;
    const dataUrl = canvas.toDataURL('image/png');
    const name = `frame_${idx}.png`;

    state.frames.push({ canvas, dataUrl, name });
    renderGrabbedFrames();
    updateGrabCount();
    toStep2.disabled = false;
  }

  function updateGrabCount() {
    const n = state.frames.length;
    grabCount.textContent = `${n} frame${n === 1 ? '' : 's'} grabbed`;
  }

  function renderGrabbedFrames() {
    grabbedFrames.innerHTML = '';
    state.frames.forEach((frame, idx) => {
      const rot = (Math.random() - 0.5) * 6; // -3 to +3 degrees
      const card = document.createElement('div');
      card.className = 'frame-card';
      card.style.transform = `rotate(${rot.toFixed(1)}deg)`;
      card.innerHTML = `
        <img src="${frame.dataUrl}" alt="Frame ${idx}">
        <div class="frame-card-caption">Frame ${idx}</div>
        <button class="frame-remove" data-idx="${idx}">&times;</button>
      `;
      grabbedFrames.appendChild(card);
    });

    // Attach delete handlers
    grabbedFrames.querySelectorAll('.frame-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = Number(e.target.dataset.idx);
        state.frames.splice(i, 1);
        renderGrabbedFrames();
        updateGrabCount();
        toStep2.disabled = state.frames.length === 0;
      });
    });
  }

  // Keyboard shortcuts (only when Step 1 is visible)
  document.addEventListener('keydown', (e) => {
    if (state.currentStep !== 1) return;
    // Ignore if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'KeyG') { grabFrame(); }
    if (e.code === 'ArrowLeft') { videoEl.currentTime = Math.max(0, videoEl.currentTime - 1); }
    if (e.code === 'ArrowRight') { videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 1); }
  });

  // ---------------------------------------------------------------------------
  // Step 2: Template Builder
  // ---------------------------------------------------------------------------

  const templateName = $('#template-name');
  const frameSelect = $('#frame-select');
  const templateCanvas = $('#template-canvas');
  const canvasContainer = $('#canvas-container');
  const rectCount = $('#rect-count');
  const coordsDisplay = $('#coords-display');
  const saveTemplateBtn = $('#save-template-btn');
  const clearRectsBtn = $('#clear-rects-btn');
  const templateListItems = $('#template-list-items');
  const toStep3 = $('#to-step-3');

  const tctx = templateCanvas.getContext('2d');

  function setupStep2() {
    // Populate frame dropdown
    frameSelect.innerHTML = '';
    state.frames.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Frame ${i}`;
      frameSelect.appendChild(opt);
    });

    currentRects = [];
    if (state.frames.length > 0) drawFrameOnCanvas(0);
    updateRectInfo();
  }

  frameSelect.addEventListener('change', () => {
    currentRects = [];
    drawFrameOnCanvas(Number(frameSelect.value));
    updateRectInfo();
  });

  function drawFrameOnCanvas(idx) {
    const frame = state.frames[idx];
    if (!frame) return;

    // Set canvas to the native image resolution
    templateCanvas.width = frame.canvas.width;
    templateCanvas.height = frame.canvas.height;

    // Let CSS handle responsive display sizing via the container
    redrawCanvas(idx);
  }

  function redrawCanvas(idx) {
    const frame = state.frames[idx !== undefined ? idx : Number(frameSelect.value)];
    if (!frame) return;

    tctx.clearRect(0, 0, templateCanvas.width, templateCanvas.height);
    tctx.drawImage(frame.canvas, 0, 0);

    // Draw existing rectangles
    currentRects.forEach((r, i) => {
      tctx.save();
      tctx.strokeStyle = '#d4a843';
      tctx.lineWidth = 3;
      tctx.setLineDash([8, 4]);
      tctx.fillStyle = 'rgba(212, 168, 67, 0.12)';
      tctx.fillRect(r.x, r.y, r.w, r.h);
      tctx.strokeRect(r.x, r.y, r.w, r.h);

      // Region number label
      tctx.setLineDash([]);
      tctx.fillStyle = '#d4a843';
      tctx.font = `bold ${Math.max(16, templateCanvas.width * 0.02)}px sans-serif`;
      tctx.fillText(`#${i + 1}`, r.x + 6, r.y + Math.max(20, templateCanvas.width * 0.025));
      tctx.restore();
    });
  }

  // Mouse-to-image coordinate conversion
  function canvasCoords(e) {
    const rect = templateCanvas.getBoundingClientRect();
    const scaleX = templateCanvas.width / rect.width;
    const scaleY = templateCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // Rectangle drawing — mouse events
  templateCanvas.addEventListener('mousedown', (e) => {
    drawing = true;
    drawStart = canvasCoords(e);
  });

  templateCanvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const pos = canvasCoords(e);
    redrawCanvas();
    // Draw in-progress rectangle
    tctx.save();
    tctx.strokeStyle = '#d4a843';
    tctx.lineWidth = 2;
    tctx.setLineDash([4, 4]);
    tctx.strokeRect(drawStart.x, drawStart.y, pos.x - drawStart.x, pos.y - drawStart.y);
    tctx.restore();
  });

  templateCanvas.addEventListener('mouseup', (e) => {
    if (!drawing) return;
    drawing = false;
    const pos = canvasCoords(e);
    finalizeRect(drawStart.x, drawStart.y, pos.x, pos.y);
  });

  // Rectangle drawing — touch events for mobile
  templateCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    const touch = e.touches[0];
    drawStart = canvasCoords(touch);
  }, { passive: false });

  templateCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!drawing) return;
    const touch = e.touches[0];
    const pos = canvasCoords(touch);
    redrawCanvas();
    tctx.save();
    tctx.strokeStyle = '#d4a843';
    tctx.lineWidth = 2;
    tctx.setLineDash([4, 4]);
    tctx.strokeRect(drawStart.x, drawStart.y, pos.x - drawStart.x, pos.y - drawStart.y);
    tctx.restore();
  }, { passive: false });

  templateCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!drawing) return;
    drawing = false;
    const touch = e.changedTouches[0];
    const pos = canvasCoords(touch);
    finalizeRect(drawStart.x, drawStart.y, pos.x, pos.y);
  }, { passive: false });

  function finalizeRect(x1, y1, x2, y2) {
    // Normalize so x,y is top-left and w,h are positive
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    // Ignore tiny accidental clicks
    if (w < 5 || h < 5) return;

    currentRects.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    redrawCanvas();
    updateRectInfo();
  }

  function updateRectInfo() {
    const n = currentRects.length;
    rectCount.textContent = `${n} region${n === 1 ? '' : 's'} drawn`;
    if (n > 0) {
      const last = currentRects[n - 1];
      coordsDisplay.textContent = `Last: (${last.x}, ${last.y}) ${last.w}x${last.h}`;
    } else {
      coordsDisplay.textContent = '';
    }
  }

  // Clear rectangles
  clearRectsBtn.addEventListener('click', () => {
    currentRects = [];
    redrawCanvas();
    updateRectInfo();
  });

  // Save template
  saveTemplateBtn.addEventListener('click', () => {
    const name = templateName.value.trim();
    if (!name) { templateName.focus(); return; }
    if (currentRects.length === 0) return;

    state.templates[name] = {
      frameIdx: Number(frameSelect.value),
      rects: currentRects.map(r => ({ ...r }))
    };

    renderTemplateList();
    toStep3.disabled = false;
  });

  function renderTemplateList() {
    templateListItems.innerHTML = '';
    Object.entries(state.templates).forEach(([name, tpl]) => {
      const div = document.createElement('div');
      div.className = 'template-item';
      div.innerHTML = `
        <span class="template-item-name">${name}</span>
        <span class="template-item-count">${tpl.rects.length} region${tpl.rects.length === 1 ? '' : 's'}</span>
        <button class="template-item-edit">Edit</button>
        <button class="template-item-delete">&times;</button>
      `;

      // Edit — load this template back into the canvas
      div.querySelector('.template-item-edit').addEventListener('click', () => {
        templateName.value = name;
        frameSelect.value = tpl.frameIdx;
        currentRects = tpl.rects.map(r => ({ ...r }));
        drawFrameOnCanvas(tpl.frameIdx);
        updateRectInfo();
      });

      // Delete
      div.querySelector('.template-item-delete').addEventListener('click', () => {
        delete state.templates[name];
        renderTemplateList();
        toStep3.disabled = Object.keys(state.templates).length === 0;
      });

      templateListItems.appendChild(div);
    });
  }

  // ---------------------------------------------------------------------------
  // Step 3: Extraction Pipeline
  // ---------------------------------------------------------------------------

  const ocrPrompt = $('#ocr-prompt');
  const frameTplMapping = $('#frame-template-mapping');
  const runPipelineBtn = $('#run-pipeline-btn');
  const pipelineProgress = $('#pipeline-progress');
  const progressFill = $('#progress-fill');
  const progressStatus = $('#progress-status');
  const resultsGrid = $('#results-grid');
  const pipelineDownload = $('#pipeline-download');
  const downloadBtn = $('#download-btn');
  const resultCount = $('#result-count');

  function setupStep3() {
    // Build frame-to-template mapping UI
    const tplNames = Object.keys(state.templates);
    frameTplMapping.innerHTML = '';

    state.frames.forEach((frame, i) => {
      const row = document.createElement('div');
      row.className = 'mapping-row';

      const thumb = document.createElement('img');
      thumb.src = frame.dataUrl;
      thumb.className = 'mapping-thumb';
      thumb.alt = `Frame ${i}`;

      const label = document.createElement('span');
      label.className = 'mapping-label';
      label.textContent = `Frame ${i}`;

      const select = document.createElement('select');
      select.className = 'select-input';
      select.dataset.frameIdx = i;
      tplNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });

      row.appendChild(thumb);
      row.appendChild(label);
      row.appendChild(select);
      frameTplMapping.appendChild(row);
    });
  }

  // Run the extraction pipeline
  runPipelineBtn.addEventListener('click', runPipeline);

  async function runPipeline() {
    const prompt = ocrPrompt.value.trim();
    const mappingSelects = frameTplMapping.querySelectorAll('select');

    // Build work list: [{frameIdx, rect, regionIdx}]
    const tasks = [];
    mappingSelects.forEach(sel => {
      const frameIdx = Number(sel.dataset.frameIdx);
      const tplName = sel.value;
      const tpl = state.templates[tplName];
      if (!tpl) return;

      tpl.rects.forEach((rect, ri) => {
        tasks.push({ frameIdx, rect, regionIdx: ri, tplName });
      });
    });

    if (tasks.length === 0) return;

    // Show progress, hide previous results
    pipelineProgress.style.display = '';
    resultsGrid.innerHTML = '';
    pipelineDownload.style.display = 'none';
    state.results = [];
    runPipelineBtn.disabled = true;

    for (let i = 0; i < tasks.length; i++) {
      const { frameIdx, rect } = tasks[i];
      const pct = Math.round(((i + 1) / tasks.length) * 100);
      progressFill.style.width = `${pct}%`;
      progressStatus.textContent = `Processing region ${i + 1} of ${tasks.length}...`;

      // Crop region from frame
      const frame = state.frames[frameIdx];
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = rect.w;
      cropCanvas.height = rect.h;
      const cctx = cropCanvas.getContext('2d');
      cctx.drawImage(frame.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      const croppedDataUrl = cropCanvas.toDataURL('image/png');

      // Send to OCR endpoint
      let ocrName = 'unknown';
      try {
        const resp = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: croppedDataUrl, prompt })
        });

        if (resp.status === 401) {
          showError(resultsGrid, 'Server returned 401 — check your API key configuration.');
          break;
        }
        if (!resp.ok) {
          showError(resultsGrid, `Server error: ${resp.status} ${resp.statusText}`);
          break;
        }

        const data = await resp.json();
        ocrName = (data.text || '').trim() || 'unknown';
      } catch (err) {
        showError(resultsGrid, `Network error: ${err.message}`);
        break;
      }

      state.results.push({ name: ocrName, dataUrl: croppedDataUrl });
    }

    // Render results
    renderResults();
    progressStatus.textContent = `Done — ${state.results.length} region${state.results.length === 1 ? '' : 's'} processed.`;
    runPipelineBtn.disabled = false;

    if (state.results.length > 0) {
      pipelineDownload.style.display = '';
      resultCount.textContent = `${state.results.length} file${state.results.length === 1 ? '' : 's'} ready`;
    }
  }

  function renderResults() {
    resultsGrid.innerHTML = '';
    state.results.forEach((result, i) => {
      const card = document.createElement('div');
      card.className = 'result-card';

      const img = document.createElement('img');
      img.src = result.dataUrl;
      img.alt = result.name;

      const nameEl = document.createElement('div');
      nameEl.className = 'result-name';
      nameEl.textContent = result.name;
      nameEl.contentEditable = true;
      nameEl.title = 'Click to edit name';

      // Save edits on blur
      nameEl.addEventListener('blur', () => {
        state.results[i].name = nameEl.textContent.trim() || 'unknown';
      });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      });

      card.appendChild(img);
      card.appendChild(nameEl);
      resultsGrid.appendChild(card);
    });
  }

  function showError(container, msg) {
    const el = document.createElement('div');
    el.className = 'error-msg';
    el.textContent = msg;
    container.appendChild(el);
  }

  // Download results as ZIP
  downloadBtn.addEventListener('click', downloadZip);

  async function downloadZip() {
    if (state.results.length === 0) return;

    if (typeof JSZip === 'undefined') {
      showError(pipelineDownload, 'JSZip library failed to load. Cannot create ZIP.');
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Zipping...';

    try {
      const zip = new JSZip();
      const usedNames = {};

      state.results.forEach((result) => {
        let base = cleanFilename(result.name);

        // Deduplicate filenames
        if (usedNames[base]) {
          usedNames[base]++;
          base = `${base}_${usedNames[base]}`;
        } else {
          usedNames[base] = 1;
        }

        // Convert data URL to binary
        const parts = result.dataUrl.split(',');
        const byteString = atob(parts[1]);
        const bytes = new Uint8Array(byteString.length);
        for (let j = 0; j < byteString.length; j++) {
          bytes[j] = byteString.charCodeAt(j);
        }

        zip.file(`${base}.png`, bytes, { binary: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extracted_portraits.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(pipelineDownload, `ZIP error: ${err.message}`);
    }

    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download All (ZIP)';
  }

})();
