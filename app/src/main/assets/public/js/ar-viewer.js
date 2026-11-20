/**
 * EcoDisassemble AR - WebXR & A-Frame Spatial AR Viewer
 * 
 * Maps 2D Edge-AI (YOLOv12) bounding box detections onto 3D spatial AR anchors
 * rendered over the live device camera stream with 30-60 FPS render synchronization.
 */

export class ARViewer {
  /**
   * @param {string|HTMLElement} container - DOM element or container ID for the AR viewport.
   */
  constructor(container = 'arContainer') {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.activeStream = null;
    this.videoElement = null;
    this.overlayCanvas = null;
    this.ctx = null;
    this.aScene = null;
    this.detections = [];
    this.isRendering = false;
    this.animationFrameId = null;
    this.inferenceIntervalId = null;
    this.pulsePhase = 0;
  }

  /**
   * Initializes the AR viewport, creating the video backdrop and spatial overlay canvas.
   * 
   * @param {MediaStream} cameraStream - Active camera stream from VideoAnalyzer.
   * @returns {HTMLElement} The root AR container.
   */
  initialize(cameraStream = null) {
    if (!this.container) {
      console.warn('[ARViewer] No container found. Creating detached AR wrapper.');
      this.container = document.createElement('div');
      this.container.id = 'arContainer';
      document.body.appendChild(this.container);
    }

    // Set container base styling via inline attributes without altering external CSS
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.width = '100%';
    this.container.style.height = '100%';

    // 1. Create or retrieve backdrop video element
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.id = 'arVideoFeed';
      this.videoElement.setAttribute('autoplay', 'true');
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.muted = true;
      this.videoElement.style.position = 'absolute';
      this.videoElement.style.top = '0';
      this.videoElement.style.left = '0';
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = '100%';
      this.videoElement.style.objectFit = 'cover';
      this.videoElement.style.zIndex = '1';
      this.container.appendChild(this.videoElement);
    }

    // 2. Create spatial overlay canvas
    if (!this.overlayCanvas) {
      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.id = 'arSpatialOverlay';
      this.overlayCanvas.style.position = 'absolute';
      this.overlayCanvas.style.top = '0';
      this.overlayCanvas.style.left = '0';
      this.overlayCanvas.style.width = '100%';
      this.overlayCanvas.style.height = '100%';
      this.overlayCanvas.style.zIndex = '2';
      this.overlayCanvas.style.pointerEvents = 'none';
      this.container.appendChild(this.overlayCanvas);
      this.ctx = this.overlayCanvas.getContext('2d');
    }

    // 3. Attach camera stream if provided
    if (cameraStream) {
      this.bindCameraStream(cameraStream);
    }

    // 4. Initialize A-Frame scene if A-Frame library is loaded
    this.initAFrameScene();

    this.startRenderLoop();
    console.log('[ARViewer] AR Spatial Viewer successfully initialized.');
    return this.container;
  }

  /**
   * Binds the live camera stream to the video backdrop and matches canvas sizing.
   */
  bindCameraStream(stream) {
    this.activeStream = stream;
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.play().catch(e => console.warn('[ARViewer] Autoplay deferred:', e));
    }
  }

  /**
   * Scaffolds an A-Frame <a-scene> overlay if A-Frame is present in the DOM.
   */
  initAFrameScene() {
    if (typeof window !== 'undefined' && window.AFRAME && !this.aScene) {
      try {
        this.aScene = document.createElement('a-scene');
        this.aScene.setAttribute('embedded', 'true');
        this.aScene.setAttribute('vr-mode-ui', 'enabled: false');
        this.aScene.style.position = 'absolute';
        this.aScene.style.top = '0';
        this.aScene.style.left = '0';
        this.aScene.style.width = '100%';
        this.aScene.style.height = '100%';
        this.aScene.style.zIndex = '3';
        this.aScene.style.pointerEvents = 'none';

        const cameraEntity = document.createElement('a-entity');
        cameraEntity.setAttribute('camera', 'active: true');
        cameraEntity.setAttribute('position', '0 0 0');
        this.aScene.appendChild(cameraEntity);

        this.container.appendChild(this.aScene);
        console.log('[ARViewer] A-Frame WebXR spatial overlay attached.');
      } catch (err) {
        console.warn('[ARViewer] A-Frame scene initialization notice:', err);
      }
    }
  }

  /**
   * Updates the active set of YOLO bounding boxes from the inference engine.
   * 
   * @param {Array<{ class: string, confidence: number, bbox: [number, number, number, number] }>} bboxes
   */
  overlayBoundingBoxes(bboxes = []) {
    this.detections = bboxes;

    // Synchronize with A-Frame 3D entities if scene exists
    if (this.aScene) {
      this.syncAFrameEntities(bboxes);
    }
  }

  /**
   * Translates 2D normalized YOLO bounding boxes to 3D A-Frame spatial coordinates.
   */
  syncAFrameEntities(bboxes) {
    // Remove previous dynamic markers
    const existing = this.aScene.querySelectorAll('.ar-dynamic-marker');
    existing.forEach(el => el.parentNode.removeChild(el));

    bboxes.forEach((box, idx) => {
      const [x1, y1, x2, y2] = box.bbox;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const bw = Math.max(0.1, x2 - x1);
      const bh = Math.max(0.1, y2 - y1);

      // Project into 3D camera space at distance Z = -1.2m
      const posX = (cx - 0.5) * 1.5;
      const posY = -(cy - 0.5) * 1.5;
      const posZ = -1.2;

      const isHazard = ['swollen_battery', 'exposed_wire', 'burnt_chip'].includes(box.class);
      const color = isHazard ? '#ff3b30' : '#c8f36b';

      const entity = document.createElement('a-entity');
      entity.classList.add('ar-dynamic-marker');
      entity.setAttribute('position', `${posX} ${posY} ${posZ}`);

      // 3D Spatial ring
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', String(Math.min(bw, bh) * 0.3));
      ring.setAttribute('radius-outer', String(Math.min(bw, bh) * 0.35));
      ring.setAttribute('color', color);
      ring.setAttribute('material', 'shader: flat; opacity: 0.85');
      entity.appendChild(ring);

      // 3D Text label
      const text = document.createElement('a-text');
      text.setAttribute('value', `${box.class.replace('_', ' ').toUpperCase()} (${Math.round(box.confidence * 100)}%)`);
      text.setAttribute('align', 'center');
      text.setAttribute('position', `0 ${bh * 0.4} 0`);
      text.setAttribute('scale', '0.4 0.4 0.4');
      text.setAttribute('color', '#ffffff');
      entity.appendChild(text);

      this.aScene.appendChild(entity);
    });
  }

  /**
   * High-performance 30-60 FPS render loop synchronized with requestAnimationFrame.
   */
  startRenderLoop() {
    if (this.isRendering) return;
    this.isRendering = true;

    const render = () => {
      if (!this.isRendering) return;

      this.pulsePhase += 0.05;
      this.drawSpatialHUD();

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Renders HUD targeting rings, bounding boxes, and component labels on the 2D overlay canvas.
   */
  drawSpatialHUD() {
    if (!this.overlayCanvas || !this.ctx) return;

    const width = this.overlayCanvas.clientWidth || 640;
    const height = this.overlayCanvas.clientHeight || 480;

    if (this.overlayCanvas.width !== width || this.overlayCanvas.height !== height) {
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
    }

    this.ctx.clearRect(0, 0, width, height);

    if (!this.detections || this.detections.length === 0) return;

    const pulseScale = 1.0 + Math.sin(this.pulsePhase) * 0.06;

    this.detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const bx = x1 * width;
      const by = y1 * height;
      const bw = (x2 - x1) * width;
      const bh = (y2 - y1) * height;

      const isHazard = ['swollen_battery', 'exposed_wire', 'burnt_chip'].includes(det.class);
      const primaryColor = isHazard ? 'rgba(255, 59, 48, ' : 'rgba(200, 243, 107, ';
      const strokeColor = primaryColor + '0.9)';
      const fillColor = primaryColor + '0.12)';

      // 1. Draw Bounding Box with rounded corners
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = strokeColor;
      this.ctx.fillStyle = fillColor;
      this.ctx.strokeRect(bx, by, bw, bh);
      this.ctx.fillRect(bx, by, bw, bh);

      // 2. Draw Target Reticle at Center
      const centerX = bx + bw / 2;
      const centerY = by + bh / 2;
      const reticleRadius = Math.max(12, Math.min(bw, bh) * 0.2) * pulseScale;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, reticleRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = strokeColor;
      this.ctx.stroke();

      // Crosshair lines
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - reticleRadius - 6, centerY);
      this.ctx.lineTo(centerX + reticleRadius + 6, centerY);
      this.ctx.moveTo(centerX, centerY - reticleRadius - 6);
      this.ctx.lineTo(centerX, centerY + reticleRadius + 6);
      this.ctx.stroke();

      // 3. Draw Component Identification Pill
      const labelText = `${det.class.replace('_', ' ').toUpperCase()} · ${Math.round(det.confidence * 100)}%`;
      this.ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      const textMetrics = this.ctx.measureText(labelText);
      const pillWidth = textMetrics.width + 16;
      const pillHeight = 22;
      const pillX = Math.max(8, Math.min(width - pillWidth - 8, bx));
      const pillY = Math.max(26, by - 6);

      this.ctx.fillStyle = isHazard ? '#ff3b30' : '#07110f';
      this.ctx.beginPath();
      this.ctx.roundRect(pillX, pillY - 16, pillWidth, pillHeight, 4);
      this.ctx.fill();

      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      this.ctx.fillStyle = isHazard ? '#ffffff' : '#c8f36b';
      this.ctx.fillText(labelText, pillX + 8, pillY - 1);
    });
  }

  /**
   * Synchronizes an automatic inference timer loop decoupled from the 60fps render loop.
   * 
   * @param {any} videoAnalyzer - Active VideoAnalyzer instance.
   * @param {any} mlEngine - Active MLEngine instance.
   * @param {number} intervalMs - Throttle interval (default 300ms ~ 3.3 FPS inference).
   * @param {Function} onDetections - Callback with detected bounding boxes.
   */
  startInferenceLoop(videoAnalyzer, mlEngine, intervalMs = 300, onDetections = null) {
    this.stopInferenceLoop();

    this.inferenceIntervalId = setInterval(async () => {
      if (!this.videoElement || this.videoElement.readyState < 2) return;

      try {
        const frame = videoAnalyzer.captureFrameFromVideo(this.videoElement);
        if (frame) {
          const detections = await mlEngine.analyzeFrames([frame]);
          this.overlayBoundingBoxes(detections);
          if (onDetections) onDetections(detections);
        }
      } catch (err) {
        console.warn('[ARViewer] Inference loop step notice:', err);
      }
    }, intervalMs);

    console.log(`[ARViewer] Decoupled inference loop started (${intervalMs}ms interval).`);
  }

  /**
   * Stops the decoupled inference loop.
   */
  stopInferenceLoop() {
    if (this.inferenceIntervalId) {
      clearInterval(this.inferenceIntervalId);
      this.inferenceIntervalId = null;
    }
  }

  /**
   * Cleanly teardown and dispose of all render loops, tracks, and resources.
   */
  dispose() {
    this.isRendering = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopInferenceLoop();
    this.detections = [];

    if (this.ctx && this.overlayCanvas) {
      this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    console.log('[ARViewer] AR Viewer successfully disposed.');
  }
}
