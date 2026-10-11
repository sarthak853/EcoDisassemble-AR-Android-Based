/**
 * Handles media extraction and conversion into standard buffers/tensors.
 */

export async function extractFrames(file, videoElement, imageElement) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.getElementById('frame-canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // Standardize output size for ML model (e.g., 640x640 for YOLO)
            const TARGET_SIZE = 640;
            canvas.width = TARGET_SIZE;
            canvas.height = TARGET_SIZE;

            const frames = [];

            if (file.type.startsWith('image/')) {
                // Ensure image is loaded
                if (imageElement.complete && imageElement.naturalHeight !== 0) {
                    ctx.drawImage(imageElement, 0, 0, TARGET_SIZE, TARGET_SIZE);
                    frames.push(ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE));
                    resolve(frames);
                } else {
                    imageElement.onload = () => {
                        ctx.drawImage(imageElement, 0, 0, TARGET_SIZE, TARGET_SIZE);
                        frames.push(ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE));
                        resolve(frames);
                    };
                }
            } else if (file.type.startsWith('video/')) {
                // For video, extract a few frames at intervals
                videoElement.onloadeddata = () => {
                    videoElement.currentTime = 0; // Start at beginning
                };
                
                videoElement.onseeked = () => {
                    if (frames.length < 3) { // Extract up to 3 frames
                        ctx.drawImage(videoElement, 0, 0, TARGET_SIZE, TARGET_SIZE);
                        frames.push(ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE));
                        
                        const nextTime = videoElement.currentTime + (videoElement.duration / 3);
                        if (nextTime < videoElement.duration) {
                            videoElement.currentTime = nextTime;
                        } else {
                            resolve(frames);
                        }
                    } else {
                        resolve(frames);
                    }
                };
            } else {
                reject(new Error("Unsupported file type"));
            }
        } catch (err) {
            reject(err);
        }
    });
}
