/**
 * AR Viewer Logic using A-Frame
 */

export function renderAR(mlResults) {
    const scene = document.getElementById('ar-scene');
    
    // Clear previous entities
    while (scene.firstChild) {
        scene.removeChild(scene.lastChild);
    }

    if (!mlResults || mlResults.length === 0) return;

    // We assume an environment where the camera is a background.
    // In a real PWA/Capacitor setup with A-Frame, we'd use 'ar' mode in WebXR.
    // For scaffolding, we'll map a simple 3D box where the detection is.
    
    mlResults.forEach(det => {
        const box = document.createElement('a-box');
        
        // Mock mapping from 2D bbox to 3D space. 
        // In reality, this requires pose estimation or raycasting against a detected plane.
        box.setAttribute('position', '0 1 -3'); 
        box.setAttribute('rotation', '0 45 0');
        
        if (det.class === 'screen_cracked') {
            box.setAttribute('color', '#007bff'); // Primary color highlight
            box.setAttribute('wireframe', 'true');
        } else {
            box.setAttribute('color', '#ff0000');
        }

        scene.appendChild(box);
    });

    const instructionCarousel = document.getElementById('current-instruction');
    instructionCarousel.textContent = `Highlighted ${mlResults[0].class}. Please begin step 1 of disassembly.`;
}
