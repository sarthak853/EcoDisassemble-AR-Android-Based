import { initDB } from './db-store.js';
import { extractFrames } from './video-analyzer.js';
import { runInference } from './ml-engine.js';
import { evaluateSafety } from './safety-gate.js';
import { renderAR } from './ar-viewer.js';

// DOM Elements
const privacyGate = document.getElementById('privacy-gate');
const btnAcceptPrivacy = document.getElementById('btn-accept-privacy');
const appContainer = document.getElementById('app-container');
const btnHistory = document.getElementById('btn-history');

// Views
const views = {
    triage: document.getElementById('view-triage'),
    processing: document.getElementById('view-processing'),
    safetyAlert: document.getElementById('view-safety-alert'),
    ar: document.getElementById('view-ar'),
    history: document.getElementById('view-history')
};

// Global App State
const state = {
    mediaFile: null,
    symptoms: '',
    analysisResult: null,
    safetyStatus: null
};

// Utilities
export function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, duration);
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }
}

// App Initialization
async function initApp() {
    try {
        await initDB();
        
        // Simple check for privacy consent in localStorage (since it's a lightweight key-value)
        if (!localStorage.getItem('privacy_consent')) {
            privacyGate.classList.remove('hidden');
        } else {
            privacyGate.classList.add('hidden');
            appContainer.classList.remove('hidden');
        }

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(err => {
                console.warn('Service worker registration failed:', err);
            });
        }
    } catch (error) {
        showToast('Initialization error: ' + error.message);
        console.error(error);
    }
}

// Event Listeners
btnAcceptPrivacy.addEventListener('click', () => {
    localStorage.setItem('privacy_consent', 'true');
    privacyGate.classList.add('hidden');
    appContainer.classList.remove('hidden');
});

const mediaUpload = document.getElementById('media-upload');
const btnAnalyze = document.getElementById('btn-analyze');
const imagePreview = document.getElementById('image-preview');
const videoPreview = document.getElementById('video-preview');
const previewContainer = document.getElementById('media-preview-container');

mediaUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (e.g., limit to 50MB)
    if (file.size > 50 * 1024 * 1024) {
        showToast('File is too large. Max 50MB.');
        mediaUpload.value = '';
        return;
    }

    state.mediaFile = file;
    const url = URL.createObjectURL(file);
    previewContainer.classList.remove('hidden');

    if (file.type.startsWith('image/')) {
        imagePreview.src = url;
        imagePreview.classList.remove('hidden');
        videoPreview.classList.add('hidden');
    } else if (file.type.startsWith('video/')) {
        videoPreview.src = url;
        videoPreview.classList.remove('hidden');
        imagePreview.classList.add('hidden');
        videoPreview.load();
    }

    btnAnalyze.disabled = false;
});

document.getElementById('triage-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    state.symptoms = document.getElementById('symptoms-input').value;

    if (!state.mediaFile) {
        showToast('Please upload an image or video first.');
        return;
    }

    switchView('processing');
    
    try {
        // 1. Extract frames (or just one frame for images)
        const frames = await extractFrames(state.mediaFile, videoPreview, imagePreview);
        
        // 2. Run local ML inference
        const mlResults = await runInference(frames);
        state.analysisResult = mlResults;
        
        // 3. Evaluate safety rules
        const safetyResult = evaluateSafety(state.symptoms, mlResults);
        state.safetyStatus = safetyResult;

        // 4. Show safety alert gate
        showSafetyGate(safetyResult);
    } catch (err) {
        console.error(err);
        showToast('Error during analysis: ' + err.message);
        switchView('triage');
    }
});

function showSafetyGate(safetyResult) {
    switchView('safetyAlert');
    const container = document.getElementById('safety-message-container');
    const title = document.getElementById('safety-title');
    const desc = document.getElementById('safety-desc');
    const btnProceed = document.getElementById('btn-proceed-ar');

    container.className = 'alert-box'; // Reset
    if (safetyResult.isSafe) {
        container.classList.add('alert-success');
        title.textContent = 'Safe to Proceed';
        desc.textContent = 'No critical hazards detected. You can begin the DIY repair.';
        btnProceed.classList.remove('hidden');
    } else {
        container.classList.add('alert-danger');
        title.textContent = 'STOP: TECHNICIAN REQUIRED';
        desc.textContent = safetyResult.reason;
        btnProceed.classList.add('hidden');
    }
}

document.getElementById('btn-proceed-ar').addEventListener('click', () => {
    switchView('ar');
    renderAR(state.analysisResult);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    // Reset state
    state.mediaFile = null;
    state.symptoms = '';
    state.analysisResult = null;
    state.safetyStatus = null;
    
    // Reset UI
    document.getElementById('triage-form').reset();
    previewContainer.classList.add('hidden');
    imagePreview.classList.add('hidden');
    videoPreview.classList.add('hidden');
    btnAnalyze.disabled = true;
    
    switchView('triage');
});

// Start app
initApp();
