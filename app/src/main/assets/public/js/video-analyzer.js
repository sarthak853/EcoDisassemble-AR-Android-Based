/**
 * EcoDisassemble AR - Video & Camera Stream Analyzer
 * 
 * Manages live camera streaming via getUserMedia and temporal frame extraction
 * using a bounded offscreen HTML5 canvas to prevent mobile OOM crashes.
 */

export class VideoAnalyzer {
  constructor(canvasElement) {
    this.canvas = canvasElement || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.currentStream = null;
    this.maxDimension = 640; // Max canvas boundary for mobile RAM safety (SEC-04)
  }

  /**
   * Request user permission and attach camera stream to a target video element.
   * 
   * @param {HTMLVideoElement} videoElement - Target video element to receive the stream.
   * @param {MediaStreamConstraints} customConstraints - Optional camera constraints.
   * @returns {Promise<MediaStream>} The active MediaStream.
   */
  async startLiveCamera(videoElement, customConstraints = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access API (getUserMedia) is not supported in this browser environment.');
    }

    // Default to back-facing environment camera optimized for component inspection
    const constraints = customConstraints || {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, min: 15 }
      }
    };

    try {
      this.stopLiveCamera(); // Clean up any active stream first
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.muted = true;
        await videoElement.play().catch(e => console.warn('[VideoAnalyzer] Autoplay prevented, waiting for gesture:', e));
      }

      console.log('[VideoAnalyzer] Live device camera successfully activated.');
      return stream;
    } catch (err) {
      console.error('[VideoAnalyzer] Failed to start live camera:', err);
      throw err;
    }
  }

  /**
   * Safely stops all camera tracks and releases hardware locks.
   */
  stopLiveCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[VideoAnalyzer] Stopped track: ${track.kind}`);
      });
      this.currentStream = null;
    }
  }

  /**
   * Safely captures a single scaled frame from a live video element.
   * 
   * @param {HTMLVideoElement} videoElement
   * @returns {ImageData|null}
   */
  captureFrameFromVideo(videoElement) {
    if (!videoElement || videoElement.readyState < 2) return null;

    const vWidth = videoElement.videoWidth || 640;
    const vHeight = videoElement.videoHeight || 480;

    // Scale down to prevent memory exhaustion on 4K/1080p feeds
    const scale = Math.min(1.0, this.maxDimension / Math.max(vWidth, vHeight));
    const targetW = Math.round(vWidth * scale);
    const targetH = Math.round(vHeight * scale);

    this.canvas.width = targetW;
    this.canvas.height = targetH;
    this.ctx.drawImage(videoElement, 0, 0, targetW, targetH);

    return this.ctx.getImageData(0, 0, targetW, targetH);
  }

  /**
   * Universal frame extraction for static images or uploaded video files.
   * 
   * @param {File|Blob} file
   * @param {number} fps - Sampling rate for temporal analysis (default 3 FPS).
   * @returns {Promise<ImageData[]>}
   */
  async extractFrames(file, fps = 3) {
    if (!file) return [];
    if (file.type.startsWith('image/')) {
      return [await this.loadImage(file)];
    }
    return this.extractVideoFrames(file, fps);
  }

  /**
   * Loads a static image into a bounded ImageData buffer.
   */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1.0, this.maxDimension / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(img, 0, 0, w, h);
        resolve(this.ctx.getImageData(0, 0, w, h));
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image file.'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Extracts temporal frames (3-5 FPS) from an uploaded video file.
   */
  extractVideoFrames(file, fps = 3) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;

      const frames = [];
      const maxDuration = 5; // Analyze at most 5 seconds of video
      const interval = 1 / Math.max(1, Math.min(5, fps));

      video.addEventListener('loadeddata', () => {
        const vWidth = video.videoWidth || 640;
        const vHeight = video.videoHeight || 480;
        const scale = Math.min(1.0, this.maxDimension / Math.max(vWidth, vHeight));
        const targetW = Math.round(vWidth * scale);
        const targetH = Math.round(vHeight * scale);

        this.canvas.width = targetW;
        this.canvas.height = targetH;
        const duration = Math.min(video.duration || 5, maxDuration);
        let currentTime = 0;

        const captureStep = () => {
          if (currentTime <= duration) {
            video.currentTime = currentTime;
            currentTime += interval;
          } else {
            URL.revokeObjectURL(objectUrl);
            resolve(frames);
          }
        };

        video.addEventListener('seeked', () => {
          this.ctx.drawImage(video, 0, 0, targetW, targetH);
          frames.push(this.ctx.getImageData(0, 0, targetW, targetH));
          captureStep();
        });

        captureStep();
      });

      video.addEventListener('error', (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to decode video file.'));
      });
    });
  }
}
