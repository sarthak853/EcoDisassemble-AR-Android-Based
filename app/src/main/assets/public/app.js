/**
 * EcoDisassemble AR - Core Application Controller
 * 
 * Coordinates:
 * - On-Device Edge-AI (MLEngine with quantized YOLOv12-Nano via ONNX Runtime Web)
 * - Video & Camera Stream Frame Extraction (VideoAnalyzer)
 * - Deterministic Life-Safety Gate (SafetyGate)
 * - WebXR & Spatial HUD AR Viewer (ARViewer)
 * - Encrypted Local Storage (DBStore with IndexedDB)
 * - Strict Privacy Telemetry Synchronization (APISync)
 */

import { MLEngine } from './js/ml-engine.js';
import { VideoAnalyzer } from './js/video-analyzer.js';
import { SafetyGate } from './js/safety-gate.js';
import { ARViewer } from './js/ar-viewer.js';
import { DBStore } from './js/db-store.js';
import { APISync } from './js/api-sync.js';

// DOM Selectors
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Instantiate Core Engines
const dbStore = new DBStore();
const apiSync = new APISync(dbStore);
const mlEngine = new MLEngine('./models/yolov12n.onnx');
const videoAnalyzer = new VideoAnalyzer();
const safetyGate = new SafetyGate();
let arViewer = null;

// Initialize Storage and Preload Model
dbStore.init().then(() => loadHistoryUI()).catch(err => logError('DBStoreInit', err));
mlEngine.loadModel().catch(err => logError('MLEnginePreload', err));

const catalog = {
  smartphone: {
    label: 'smartphone', baseRisk: 'MODERATE', baseDIY: 'ADVANCED DIY',
    cases: [
      { id:'charge', words:['charge','charging','cable','usb','port','loose','angle'], name:'Charging port or connector', layer:'port', reason:'Cable position and charging behavior often point to debris, port wear, or a loose connector.', confirm:'Power the phone off. Inspect the port with bright light and test one known-good certified cable and adapter. Never probe it with metal.', parts:['Charging port assembly','Port gasket'], diy:'GUIDED DIY', risk:'MODERATE', guide:[['Rule out an external cause','Power off. Check the cable and adapter on another compatible device.'],['Inspect without metal tools','Use bright light to look for compacted lint, corrosion, or a bent center tongue.'],['Choose the repair path','External lint removal may be DIY with a non-conductive tool. A loose or damaged port needs a model-specific guide; soldered ports need a technician.'],['Verify after reassembly','Test wired charging, data transfer, microphone, and speaker functions before sealing the device.']] },
      { id:'display', words:['screen','display','flicker','line','touch','crack','black picture'], name:'Display assembly or flex connector', layer:'display', reason:'Visible lines, flicker, touch failure, or impact damage are commonly within the display path.', confirm:'Capture whether the issue appears in a screenshot or only on the physical panel. Check for impact marks and whether gentle hinge/frame movement changes it—without flexing the device.', parts:['Display assembly','Display adhesive set'], diy:'ADVANCED DIY', risk:'MODERATE', guide:[['Back up the device','If it still works, make a local backup before any disassembly.'],['Check for battery danger','Do not press a lifted screen down; it can indicate a swollen battery.'],['Match the exact assembly','Use the verified model and regional variant to select a compatible display and adhesive.'],['Use a model-specific guide','Heat and prying near a lithium cell can cause fire. Stop if the guide differs from your device.']] },
      { id:'battery', words:['battery','drain','shut down','shutdown','swollen','swelling','hot','overheat','percentage'], name:'Battery pack or battery connector', layer:'power', reason:'Rapid drain, unexpected shutdown, heat, or enclosure lift can originate in the battery power path.', confirm:'Check battery-health diagnostics if available. Swelling, sweet/chemical odor, hissing, smoke, or severe heat is sufficient reason to stop—do not charge it.', parts:['Battery pack','Battery adhesive strips'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Stop charging if swelling is possible','Move the unplugged device away from flammable materials without bending or squeezing it.'],['Do not puncture or flatten','A damaged lithium cell can enter thermal runaway.'],['Arrange safe service','Use a repair provider equipped for lithium battery removal and disposal.'],['Transport carefully','Follow local hazardous-battery transport guidance; never mail a damaged cell without approved packaging.']] },
      { id:'power', words:['dead','no power','wont turn','won’t turn','not turning','boot loop','restart'], name:'Power chain / main-board fault', layer:'mainboard', reason:'A no-power symptom can involve the battery, connector, charging controller, or board-level power management.', confirm:'Test a known-good charger, allow the normal charging interval, and record LED/vibration/heat behavior. Board-level confirmation needs voltage/current measurements.', parts:['Power sub-board'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Document observable signs','Record LEDs, vibration, sounds, and whether the device warms while connected.'],['Rule out known-good accessories','Try one compatible certified charger and cable. Stop if there is heat or odor.'],['Protect the data','Do not repeatedly power-cycle a liquid-damaged or overheating device.'],['Request board-level diagnosis','A technician should measure the power rails before any part is ordered.']] },
      { id:'camera', words:['camera','blurry','focus','shake','photo'], name:'Camera module or lens cover', layer:'mainboard', reason:'Persistent blur, focus hunting, or image shake can come from a dirty lens cover, impact, or camera-module stabilizer.', confirm:'Clean only the exterior glass and compare front/rear cameras in multiple apps. A repeated mechanical rattle or focus failure supports module inspection.', parts:['Camera module','Camera lens cover'], diy:'ADVANCED DIY', risk:'MODERATE', guide:[['Clean the exterior lens','Use a clean microfiber cloth—no liquid should enter the openings.'],['Compare camera modes','Test each lens and one other camera app to separate software from hardware.'],['Back up before opening','Camera replacement requires a model-specific teardown and dust control.'],['Calibrate and verify','Some models need post-repair calibration; check focus at near and far distances.']] }
    ]
  },
  laptop: {
    label:'laptop', baseRisk:'MODERATE', baseDIY:'ADVANCED DIY',
    cases:[
      { id:'thermal', words:['hot','heat','overheat','fan','noise','noisy','slow','thermal','shutdown'], name:'Cooling fan / blocked airflow', layer:'mainboard', reason:'Heat, fan noise, throttling, and shutdown commonly involve blocked vents, a worn fan, or poor heatsink contact.', confirm:'Check temperatures and fan RPM with the manufacturer diagnostic tool. Listen for scraping and inspect external vents while powered off.', parts:['Cooling fan','Thermal interface material'], diy:'GUIDED DIY', risk:'MODERATE', guide:[['Shut down and unplug','Let the laptop cool fully before inspection.'],['Check external airflow','Inspect vents for blockage. Do not spin the fan with high-pressure air.'],['Run manufacturer diagnostics','Use the built-in fan test before ordering a part.'],['Follow the service manual','Disconnect the internal battery before fan removal; apply only the specified thermal material.']] },
      { id:'power', words:['charge','charging','adapter','jack','usb-c','battery not','plug','no power','dead'], name:'Adapter, charging jack, or power board', layer:'port', reason:'Intermittent charge or no-power behavior can arise before the main board—from the adapter, cable, jack, or USB-C daughterboard.', confirm:'Use a known-good compatible adapter and inspect the jack for movement or scorching. Current measurements require proper test equipment.', parts:['DC-in / USB-C power board'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Inspect the adapter first','Stop using any frayed, hot, cracked, or sparking mains adapter.'],['Run battery diagnostics','Record the adapter detection and battery-health result if the laptop starts.'],['Check whether the jack moves','Do not force it. A moving or scorched jack needs service.'],['Ask for rail measurements','A technician should distinguish a jack, sub-board, battery, and main-board fault before ordering.']] },
      { id:'display', words:['screen','flicker','line','black','hinge','display','picture'], name:'Display cable or panel', layer:'display', reason:'Flicker, lines, or changes with lid angle often involve the panel or the cable routed through the hinge.', confirm:'Test an external display and record whether the fault changes with lid angle. Do not repeatedly flex a damaged hinge.', parts:['Display cable','Display panel'], diy:'ADVANCED DIY', risk:'MODERATE', guide:[['Test an external display','This helps separate graphics output from the internal display path.'],['Inspect hinge behavior','Move the lid only normally; stop if the hinge is cracked or stiff.'],['Disconnect all power','Unplug and disconnect the internal battery before touching display connectors.'],['Use the exact panel ID','Laptop model names can ship with different panel connectors and resolutions.']] },
      { id:'keyboard', words:['key','keyboard','trackpad','touchpad','typing','spill'], name:'Keyboard / input top case', layer:'casing', reason:'Grouped key failures or a post-spill issue often originate in the keyboard matrix, ribbon cable, or top-case assembly.', confirm:'Use an external keyboard and firmware diagnostics. For any liquid exposure, keep the laptop off and arrange inspection.', parts:['Keyboard / top-case assembly'], diy:'ADVANCED DIY', risk:'MODERATE', guide:[['Do not power a wet laptop','Disconnect charger; if safely accessible, disconnect the battery.'],['Test an external input device','This separates OS behavior from the built-in keyboard path.'],['Check the service-manual scope','Some keyboards are replaceable; others are riveted into the top case.'],['Replace only after identification','Match language layout, backlight, connector, and exact chassis revision.']] },
      { id:'battery', words:['battery','drain','swollen','swelling','trackpad raised','only works plugged'], name:'Battery pack', layer:'power', reason:'Short runtime, shutdown under load, or enclosure/trackpad lift can indicate a worn or swollen pack.', confirm:'Review cycle count and health. Any physical lift, odor, or abnormal heat means stop using and charging the laptop.', parts:['Laptop battery pack'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Stop if the case is lifting','Do not press the trackpad or bottom cover back into place.'],['Shut down and unplug','Keep the device on a nonflammable surface.'],['Do not remove a swollen pack casually','Fasteners and adhesive can load or puncture the cell.'],['Use qualified battery service','The old battery must enter an approved recycling stream.']] }
    ]
  },
  headphones: {
    label:'headphones', baseRisk:'LOW', baseDIY:'GUIDED DIY',
    cases:[
      { id:'cable', words:['one side','left','right','cut','cable','wire','angle','intermittent','jack'], name:'Audio cable / jack connection', layer:'port', reason:'Audio that returns when the cable or plug moves strongly suggests cable strain, jack contamination, or a broken conductor.', confirm:'Test another source and, if detachable, another cable. Compare wired and wireless modes without opening the headset.', parts:['Audio cable','Jack / connector module'], diy:'GUIDED DIY', risk:'LOW', guide:[['Test another source','Use a known-good phone or computer at low volume.'],['Swap detachable parts','Try another compatible cable before opening the earcup.'],['Inspect strain points','Look for cuts and kinks near the plug and entry point.'],['Replace by construction type','A modular cable is simple DIY; soldered internal wire requires soldering skill and a wiring diagram.']] },
      { id:'driver', words:['no sound','quiet','distort','buzz','rattle','bass'], name:'Speaker driver or acoustic seal', layer:'display', reason:'Persistent low output, distortion, or rattle on one side can involve the driver, debris, or a damaged ear-pad seal.', confirm:'Use a low-volume left/right channel test and compare after reseating removable pads. Stop if high volume is needed to hear.', parts:['Speaker driver','Ear cushion / acoustic seal'], diy:'ADVANCED DIY', risk:'LOW', guide:[['Protect your hearing','Keep test volume low; do not use loud sweeps.'],['Check pads and mesh','A poor seal or blocked mesh can mimic driver failure.'],['Run a channel test','Confirm the same side fails on more than one source.'],['Inspect only with a guide','Thin driver diaphragms and wires are easy to damage; solder only if trained.']] },
      { id:'battery', words:['battery','charge','charging','dies','runtime','swollen','hot'], name:'Battery or charging board', layer:'power', reason:'Short wireless runtime, no charge, or abnormal heat may come from the battery, port, or charging controller.', confirm:'Try a known-good low-voltage cable and inspect for swelling or heat. Stop immediately if the earcup is separating.', parts:['Headphone battery','Charging port board'], diy:'ADVANCED DIY', risk:'MODERATE', guide:[['Stop for heat or swelling','Do not wear, charge, or compress a separating earcup.'],['Rule out the cable','Try one known-good compatible charging cable and power source.'],['Confirm battery access','Some packs are soldered and lack protection tabs; use a model-specific teardown.'],['Dispose safely','Never place a lithium battery in household waste.']] },
      { id:'mic', words:['microphone','mic','voice','call','not hear'], name:'Microphone module or cable', layer:'mainboard', reason:'Call-only failure can involve the boom cable, mute switch, microphone capsule, or USB/Bluetooth processing.', confirm:'Check hardware mute, OS input selection, and a second device. Record a local sample without sharing it.', parts:['Microphone / boom module'], diy:'GUIDED DIY', risk:'LOW', guide:[['Check mute and permissions','Confirm the physical mute control and correct input device.'],['Test on another device','This separates headset hardware from OS configuration.'],['Reseat a detachable boom','Clean only exposed contacts with the device off.'],['Replace the modular part','If the mic is internal or soldered, use a technician or model-specific guide.']] }
    ]
  },
  tv: {
    label:'television', baseRisk:'HIGH', baseDIY:'TECHNICIAN',
    cases:[
      { id:'backlight', words:['sound but no picture','no picture','dark','flashlight','dim','backlight','black screen'], name:'LED backlight strips / driver', layer:'display', reason:'Audio with an extremely dim image can indicate the panel backlight or its driver, but confirmation requires safe electrical testing.', confirm:'With the TV assembled, check whether menus/audio respond. Do not remove the back: TV power boards can retain hazardous charge.', parts:['LED backlight strip set'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Unplug the TV','Do not open the rear enclosure. Capacitors may remain hazardous after unplugging.'],['Record the symptoms','Note startup flashes, audio, standby LED pattern, and whether menus respond.'],['Check external sources','Use the TV menu to separate an input issue from a display issue.'],['Book qualified service','Backlight replacement exposes high voltage and risks cracking the large panel.']] },
      { id:'power', words:['no power','dead','click','standby','red light','turn on','power'], name:'Power-supply or standby circuit', layer:'power', reason:'No standby response, repeated clicking, or startup cycling can originate in the internal power supply or a downstream short.', confirm:'Test the wall outlet and detachable mains lead only. Internal voltage and capacitor checks are technician-only.', parts:['TV power-supply board'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Unplug and leave closed','Do not access an internal fuse or board; hazardous stored energy may remain.'],['Verify the outlet externally','Test the outlet with a safe known-good device and inspect the power cord.'],['Record the LED pattern','Count blinks/clicks and note the exact sequence for service.'],['Use qualified TV service','A board should not be ordered until the power rails and loads are tested.']] },
      { id:'image', words:['line','half screen','color','solarized','picture','t-con','vertical'], name:'Panel timing path / T-Con board', layer:'mainboard', reason:'Lines, half-image, or severe color artifacts can arise in the timing-control path, panel bonds, or main board.', confirm:'Check whether the TV on-screen menu has the same artifact. If yes, the source device is unlikely to be the cause.', parts:['Timing-control board'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Keep the enclosure closed','Internal TV circuitry includes mains and stored-voltage hazards.'],['Test the built-in menu','Photograph whether the artifact overlays the TV menu.'],['Check another source and cable','If only one source fails, replace the cable before service.'],['Request panel-path diagnosis','Panel tab-bond faults can mimic a replaceable board and may be uneconomical.']] },
      { id:'input', words:['hdmi','input','signal','port','console'], name:'HDMI cable / input board', layer:'port', reason:'A source-specific no-signal issue may be the cable, source settings, connector, or input board.', confirm:'Try a known-good certified cable, another TV port, and another source at a supported resolution.', parts:['HDMI input board'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Keep the TV closed','Only external connection tests are DIY-safe.'],['Swap cable and port','Power devices off before changing connections.'],['Reset source resolution','Use a supported video mode and check the TV input selection.'],['Service only if all ports fail','Internal connector or main-board work requires qualified service.']] }
    ]
  },
  fridge: {
    label:'refrigerator', baseRisk:'HIGH', baseDIY:'TECHNICIAN',
    cases:[
      { id:'airflow', words:['not cooling','warm','cooling','hot','runs always','condenser','fan'], name:'Airflow, condenser, or fan system', layer:'mainboard', reason:'Poor cooling can result from blocked airflow, dirty accessible coils, a failed fan, controls, or the sealed refrigerant system.', confirm:'Record actual compartment temperatures and whether fans/compressor run. Only clean manufacturer-designated accessible coils with power disconnected.', parts:['Evaporator / condenser fan'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Protect food first','Move perishable food to safe refrigeration and record compartment temperature.'],['Unplug before accessible cleaning','Follow the owner manual only; do not remove electrical covers.'],['Check clearance and door seal','Confirm vents are not blocked and the gasket closes evenly.'],['Call appliance service','Fan voltage, refrigerant, compressor, and internal electrical work are technician-only.']] },
      { id:'defrost', words:['ice','frost','freezer','icing','defrost'], name:'Defrost heater / sensor path', layer:'power', reason:'Heavy recurring frost and reduced airflow can involve a heater, thermistor, control, drain, or door-seal issue.', confirm:'Photograph frost distribution and check the door gasket. Electrical confirmation requires resistance/voltage tests with the appliance isolated.', parts:['Defrost heater','Defrost thermistor'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Preserve food safety','Move food and monitor temperature.'],['Use only the owner-manual defrost method','Do not use knives, heat guns, or boiling water on the liner.'],['Inspect the door gasket','Look for gaps or debris without dismantling the appliance.'],['Arrange service if frost returns','The heater, sensor, and control require isolated electrical tests.']] },
      { id:'drain', words:['water','leak','puddle','drain','dripping'], name:'Drain path or water-line connection', layer:'port', reason:'Water inside the cabinet can come from a blocked defrost drain; external leaks can also involve the supply line or valve.', confirm:'Identify whether the water is inside, under, or behind the unit. Shut the water valve if an external supply leak is visible.', parts:['Defrost drain tube','Water inlet valve'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Keep water away from electricity','Unplug only if the plug and floor are dry and safely reachable.'],['Shut the supply valve','If a connected water line is leaking, close its valve without moving a flooded appliance.'],['Locate without dismantling','Record whether water is inside, front, or rear.'],['Use appliance service','Internal drains, valves, wiring, and moving a heavy appliance create additional risks.']] },
      { id:'compressor', words:['click','buzz','compressor','not running','cycles'], name:'Start device / compressor system', layer:'power', reason:'Clicking or short cycling may involve the start relay, supply conditions, controls, or a sealed-system compressor fault.', confirm:'Record timing and sound; verify the appliance has ventilation. Do not access the compressor terminals or refrigerant tubing.', parts:['Compressor start device'], diy:'TECHNICIAN', risk:'HIGH', guide:[['Do not access the rear electrical cover','Mains voltage, hot surfaces, and moving machinery are present.'],['Record the cycle','Note how often it clicks and whether temperatures are rising.'],['Check only owner-manual items','Confirm ventilation clearance and an undamaged external cord.'],['Call sealed-system service','A technician must test the start components and compressor safely.']] }
    ]
  },
  microphone: {
    label:'microphone', baseRisk:'LOW', baseDIY:'GUIDED DIY',
    cases:[
      { id:'cable', words:['noise','static','crackle','cable','xlr','usb','intermittent','hum'], name:'Cable, connector, or grounding path', layer:'port', reason:'Crackle that changes with a cable or connector often indicates a bad cable, dirty contact, damaged socket, or grounding issue.', confirm:'At safe monitoring volume, test one known-good cable and a second input. For condenser mics, power equipment down before changing phantom-power connections.', parts:['Audio / USB cable','Input connector module'], diy:'GUIDED DIY', risk:'LOW', guide:[['Lower monitoring gain','Protect speakers and hearing before reconnecting anything.'],['Power down before re-cabling','Especially when phantom power is used.'],['Swap one item at a time','Try a known-good cable, then a known-good interface input.'],['Replace modular components first','Socket soldering or internal grounding repair requires electronics skill.']] },
      { id:'capsule', words:['quiet','muffled','distort','no sound','capsule','dropped'], name:'Capsule or internal lead', layer:'display', reason:'Persistent low output, changed tone, or impact-related failure may involve the acoustic path, capsule, or a detached internal wire.', confirm:'Compare with a known-good microphone using the same cable/interface settings; inspect only the external grille and pad/roll-off switches.', parts:['Microphone capsule'], diy:'TECHNICIAN', risk:'MODERATE', guide:[['Rule out signal-chain settings','Verify gain, input, pad, phantom-power requirement, and cable.'],['Compare under controlled conditions','Use the same source distance and low monitoring level.'],['Do not touch the diaphragm','Capsules are delicate and contamination can permanently alter response.'],['Use specialist service','Capsule matching and calibration may matter more than physical fit.']] },
      { id:'usb', words:['not detected','computer','disconnect','usb','device','recognized'], name:'USB port or interface board', layer:'mainboard', reason:'Enumeration failures can arise from the cable, connector, firmware, power, or the microphone interface board.', confirm:'Try a known-good data cable and direct computer port, then check whether the device appears in system hardware information.', parts:['USB connector / interface board'], diy:'ADVANCED DIY', risk:'LOW', guide:[['Use a real data cable','Some USB cables carry power only.'],['Avoid unpowered hubs','Connect directly and try a second computer if available.'],['Inspect the external port','Look for a bent tongue or looseness; do not probe it.'],['Escalate soldered-port repair','Board-mounted USB connectors need proper rework tools and inspection.']] },
      { id:'phantom', words:['phantom','48v','condenser','power','dead'], name:'Phantom-power or preamp path', layer:'power', reason:'A condenser microphone may appear dead because phantom power, cable wiring, interface configuration, or internal electronics are missing/faulty.', confirm:'Verify the microphone actually requires 48 V and that the interface supports it. Never apply phantom power to equipment that prohibits it.', parts:['Microphone preamp board'], diy:'TECHNICIAN', risk:'MODERATE', guide:[['Read both manuals','Confirm microphone power requirements and interface capability.'],['Set gain low and power down','Connect a balanced XLR cable before enabling phantom power.'],['Test known-good balanced equipment','Swap one component at a time.'],['Use electronics service','Internal high-impedance circuits are contamination-sensitive and need measurements.']] }
    ]
  }
};

const fallbackCase = {
  id:'general', words:[], name:'Unresolved component path', layer:'mainboard',
  reason:'The current evidence does not separate a replaceable part from software, connection, power, or board-level causes.',
  confirm:'Add a clear close-up plus a wider context photo, record exact behavior and timing, and run the manufacturer diagnostic procedure.',
  parts:[], diy:'TECHNICIAN', risk:'MODERATE',
  guide:[['Disconnect power','Do not continue if there is heat, smell, smoke, swelling, or liquid.'],['Document the symptom','Record when it began, what changed, and every visible or audible sign.'],['Run non-invasive checks','Use the owner manual and manufacturer diagnostics without opening the device.'],['Get a measured diagnosis','Do not order a part until the faulty subsystem has been confirmed.']]
};

const layerPositions = {
  casing:{left:'68%',top:'25%'}, display:{left:'51%',top:'31%'}, mainboard:{left:'52%',top:'43%'}, power:{left:'61%',top:'58%'}, port:{left:'42%',top:'69%'}
};
const imagePositions = { smartphone:['59%','62%'], laptop:['64%','66%'], headphones:['40%','53%'], tv:['54%','49%'], fridge:['58%','67%'], microphone:['47%','61%'] };

const form = $('#diagnosticForm');
const photoInput = $('#photoInput');
const dropzone = $('#dropzone');
const uploadEmpty = $('#uploadEmpty');
const imageWrap = $('#imageWrap');
const imagePreview = $('#imagePreview');
const imagePin = $('#imagePin');
const results = $('#results');

let selectedFile = null;
let imageUrl = null;
let manifest = [];
let rotation = -35;
let dragStart = null;
let deferredInstall = null;
let activeDetections = [];

function toast(message) {
  const node = $('#toast');
  $('p', node).textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3500);
}

function showImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    toast('Please choose an image or short video file.');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    toast('File size exceeds 15 MB limit.');
    return;
  }

  selectedFile = file;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = URL.createObjectURL(file);

  if (file.type.startsWith('video/')) {
    // If video, create a poster frame or use default preview
    imagePreview.src = 'assets/icon.svg';
    toast('Video loaded. Temporal frame analysis active.');
  } else {
    imagePreview.src = imageUrl;
  }

  uploadEmpty.hidden = true;
  imageWrap.hidden = false;
  imagePin.hidden = true;
}

photoInput.addEventListener('change', event => showImage(event.target.files[0]));
$('#replaceImage').addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  photoInput.click();
});

['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, event => {
  event.preventDefault();
  dropzone.classList.add('dragging');
}));
['dragleave','drop'].forEach(type => dropzone.addEventListener(type, event => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
}));
dropzone.addEventListener('drop', event => {
  event.preventDefault();
  showImage(event.dataTransfer.files[0]);
});

// Live WebRTC / WebXR AR Scanner Modal Wiring
const arDialog = $('#arDialog');
const startLiveARBtn = $('#startLiveAR');
const closeARBtn = $('#closeARBtn');
const captureARFrameBtn = $('#captureARFrameBtn');

if (startLiveARBtn) {
  startLiveARBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (arDialog && typeof arDialog.showModal === 'function') {
        arDialog.showModal();
      }

      if (!arViewer) {
        arViewer = new ARViewer(document.getElementById('arLiveContainer'));
      }

      const stream = await videoAnalyzer.startLiveCamera(arViewer.videoElement);
      arViewer.initialize(stream);

      // Start decoupled 30fps AR rendering + ~3 FPS YOLO inference loop
      arViewer.startInferenceLoop(videoAnalyzer, mlEngine, 350, (detections) => {
        activeDetections = detections;
        const count = detections.length;
        const statusEl = $('#arStatusText');
        const badgeEl = $('#arInferenceBadge');

        if (statusEl) {
          statusEl.textContent = count > 0 
            ? `Detected ${count} object(s): ${detections.map(d => d.class.replace('_', ' ')).join(', ')}` 
            : 'Scanning components... Hold camera steady over circuit or port.';
        }
        if (badgeEl) {
          badgeEl.textContent = `PROVIDER: ${mlEngine.executionProvider.toUpperCase()} · 30 FPS`;
        }
      });
    } catch (err) {
      logError('StartLiveAR', err);
      toast(`Camera access error: ${err.message || 'Permission denied'}`);
      if (arDialog && arDialog.open) arDialog.close();
    }
  });
}

function stopLiveARScanner() {
  if (arViewer) arViewer.dispose();
  videoAnalyzer.stopLiveCamera();
  if (arDialog && arDialog.open) arDialog.close();
}

if (closeARBtn) closeARBtn.addEventListener('click', stopLiveARScanner);
if (arDialog) {
  arDialog.addEventListener('click', (e) => {
    if (e.target === arDialog) stopLiveARScanner();
  });
}

if (captureARFrameBtn) {
  captureARFrameBtn.addEventListener('click', async () => {
    if (!arViewer || !arViewer.videoElement) return;

    try {
      const frameData = videoAnalyzer.captureFrameFromVideo(arViewer.videoElement);
      if (frameData) {
        // Convert ImageData to a Blob
        const c = document.createElement('canvas');
        c.width = frameData.width;
        c.height = frameData.height;
        c.getContext('2d').putImageData(frameData, 0, 0);

        c.toBlob(blob => {
          if (blob) {
            blob.name = 'ar_capture.png';
            showImage(blob);
            stopLiveARScanner();
            toast('Frame captured from AR session! Click Run Private Triage.');
          }
        }, 'image/png');
      }
    } catch (err) {
      logError('CaptureARFrame', err);
      toast('Failed to capture frame from AR stream.');
    }
  });
}

function normalize(text) { return text.toLowerCase().replace(/[’']/g, "'"); }
function scoreCase(item, text) {
  return item.words.reduce((score, word) => score + (text.includes(word) ? (word.includes(' ') ? 4 : 2) : 0), 0);
}
function rankCases(category, symptom) {
  const text = normalize(symptom);
  const list = catalog[category].cases.map((item, order) => ({ item, score: scoreCase(item, text), order }));
  list.sort((a,b) => b.score - a.score || a.order - b.order);
  if (list[0].score === 0) return [{item:fallbackCase,score:0}, ...list.slice(0,2)];
  return list.slice(0,3);
}
function getHazards() { return $$('.hazards input:checked').map(input => input.value); }

function renderHypotheses(ranked) {
  const strengths = ['BEST MATCH','POSSIBLE','ALTERNATIVE'];
  $('#hypothesisList').innerHTML = ranked.map(({item,score}, index) => `
    <article class="hypothesis-list-item">
      <span class="rank">${String(index+1).padStart(2,'0')}</span>
      <div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.reason)}</p></div>
      <span class="strength ${index===1?'moderate':index===2?'low':''}">${score === 0 && index === 0 ? 'INSUFFICIENT' : strengths[index]}</span>
    </article>`).join('');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function renderManifest(parts) {
  manifest = parts.map(part_name => ({part_name, quantity:1}));
  const container = $('#manifestRows');
  container.innerHTML = manifest.length ? manifest.map((part,index) => `
    <div class="manifest-row" data-index="${index}">
      <div class="part-title">${escapeHtml(part.part_name)}<small>UNVERIFIED · MATCH MODEL FIRST</small></div>
      <div class="quantity"><button type="button" data-delta="-1" aria-label="Decrease quantity">−</button><b>1</b><button type="button" data-delta="1" aria-label="Increase quantity">+</button></div>
    </div>`).join('') : '<div class="manifest-row"><div class="part-title">No part selected<small>MORE EVIDENCE IS REQUIRED BEFORE ORDERING</small></div><div class="quantity">—</div></div>';
  updatePayload();
}

function updatePayload() { $('#payloadPreview').textContent = JSON.stringify(manifest, null, 2); }

$('#manifestRows').addEventListener('click', event => {
  const button = event.target.closest('[data-delta]');
  if (!button) return;
  const row = button.closest('.manifest-row');
  const index = Number(row.dataset.index);
  manifest[index].quantity = Math.max(1, Math.min(99, manifest[index].quantity + Number(button.dataset.delta)));
  $('.quantity b', row).textContent = manifest[index].quantity;
  updatePayload();
});

function update3D(item, category, modelNumber) {
  const pos = layerPositions[item.layer] || layerPositions.mainboard;
  const hotspot = $('#partHotspot');
  hotspot.style.left = pos.left; hotspot.style.top = pos.top;
  $('#hotspotLabel').textContent = item.layer.toUpperCase() + ' AREA';
  $('#componentName').textContent = item.name;
  $('#componentReason').textContent = item.reason;
  $$('.device-layer').forEach(layer => layer.style.borderColor = layer.dataset.layer === item.layer ? '#c8f36b' : 'rgba(200,243,107,.35)');
  $('#modelScope').textContent = modelNumber ? `${modelNumber} · generic map until model asset is verified` : `Generic ${catalog[category].label} layered schematic`;
  const [left,top] = imagePositions[category] || ['50%', '50%'];
  imagePin.style.left = left; imagePin.style.top = top; imagePin.hidden = false;
}

function renderGuide(item, verdict) {
  $('#guideTitle').textContent = verdict.diy === 'TECHNICIAN' || verdict.diy === 'NO DIY' ? 'Safe handoff checklist' : 'Safe next steps';
  $('#guideSubtitle').textContent = `${verdict.diy} · ${verdict.risk} risk`;
  const safety = $('#guideSafety');
  safety.className = 'guide-safety' + (verdict.cls === 'safe' ? ' safe' : '');
  safety.innerHTML = verdict.diy === 'NO DIY'
    ? '<b>Stop condition:</b> Do not test the device again. Do not puncture, drain, discharge, or dismantle it.'
    : verdict.diy === 'TECHNICIAN'
      ? '<b>Internal work is not a solo repair.</b> Complete only the external observations below and give them to a qualified technician.'
      : '<b>DIY is conditional.</b> Continue only if the exact device, part, tools, and model-specific guide all match.';
  $('#guideSteps').innerHTML = item.guide.map(step => `<li><div><b>${escapeHtml(step[0])}</b><p>${escapeHtml(step[1])}</p></div></li>`).join('');
}

function renderVerdict(verdict) {
  const card = $('#verdictCard');
  card.className = `verdict-card panel ${verdict.cls}`;
  $('#verdictIcon').textContent = verdict.icon;
  $('#verdictKicker').textContent = verdict.kicker;
  $('#verdictTitle').textContent = verdict.title;
  $('#verdictText').textContent = verdict.text;
  $('#riskLabel').textContent = verdict.risk;
  $('#diyLabel').textContent = verdict.diy;
}

// Main Diagnostic Form Submission with Live Edge-AI & Safety Gate
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedFile) {
    toast('Add a photo or use the Live AR Scanner to begin inspection.');
    dropzone.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if (!form.reportValidity()) return;

  const button = $('.analyze', form);
  button.disabled = true;
  $('.analyze-label',button).textContent = 'Running Edge-AI & Safety Gate...';
  $('.spinner',button).hidden = false;

  const category = $('#category').value;
  const symptom = $('#symptom').value.trim();
  const modelNumber = $('#modelNumber').value.trim();
  const hazards = getHazards();

  try {
    // 1. Extract Frames via VideoAnalyzer (Temporal sampling with bounded RAM)
    const frames = await videoAnalyzer.extractFrames(selectedFile, 3);

    // 2. Run ONNX Runtime Web Model Inference
    const aiResults = await mlEngine.analyzeFrames(frames);

    // 3. Evaluate Multimodal Inputs via Deterministic Safety Gate
    const gateResult = safetyGate.evaluate(symptom, aiResults, hazards);

    // 4. Calculate Catalog Hypotheses
    const ranked = rankCases(category, symptom);
    const top = ranked[0].item;

    let verdict;
    if (gateResult.flag === 'HAZARD_STOP') {
      verdict = {
        cls: 'stop',
        icon: '×',
        kicker: 'STOP: TECHNICIAN REQUIRED',
        title: 'Severe hazard identified.',
        text: gateResult.message,
        risk: 'STOP',
        diy: 'NO DIY'
      };
    } else if (gateResult.flag === 'WARNING') {
      verdict = {
        cls: '',
        icon: '!',
        kicker: 'TECHNICIAN ADVISED',
        title: 'Disconnect power immediately.',
        text: gateResult.message,
        risk: 'HIGH',
        diy: 'TECHNICIAN'
      };
    } else {
      verdict = {
        cls: 'safe',
        icon: '✓',
        kicker: gateResult.diyLevel,
        title: 'Start with non-invasive checks.',
        text: gateResult.message,
        risk: gateResult.riskLevel,
        diy: gateResult.diyLevel
      };
    }

    renderVerdict(verdict);
    renderHypotheses(ranked);
    $('#confirmText').textContent = top.confirm;
    update3D(top, category, modelNumber);
    renderGuide(top, verdict);
    renderManifest(top.parts);

    results.hidden = false;
    results.scrollIntoView({behavior:'smooth',block:'start'});

    // 5. Encrypted Dual-Storage: Save to IndexedDB
    const sessionId = await dbStore.saveSession({
      category,
      modelNumber,
      symptom,
      hazards,
      aiDetections: aiResults,
      verdict,
      provider: mlEngine.executionProvider
    });

    toast(`Triage complete (${mlEngine.executionProvider.toUpperCase()}). Saved to on-device vault.`);
    loadHistoryUI();
  } catch (err) {
    logError('InspectionSubmit', err);
    toast(`Inference notice: ${err.message || 'Completed with fallback'}`);
  } finally {
    button.disabled = false;
    $('.analyze-label',button).textContent = 'Run private triage';
    $('.spinner',button).hidden = true;
  }
});

$('#newInspection').addEventListener('click', () => {
  results.hidden = true;
  form.reset();
  selectedFile = null;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
  imagePreview.removeAttribute('src');
  imageWrap.hidden = true;
  uploadEmpty.hidden = false;
  imagePin.hidden = true;
  form.scrollIntoView({behavior:'smooth',block:'start'});
});

// Telemetry Cloud Sync using APISync
$('#syncManifest').addEventListener('click', async () => {
  if (!manifest.length) {
    toast('No replacement part is ready to sync.');
    return;
  }

  const note = $('#syncNote');
  try {
    note.innerHTML = '<span></span>Validating payload and checking rate limits...';
    const result = await apiSync.syncToCloud(manifest);
    if (result.success) {
      note.classList.add('done');
      note.innerHTML = '<span></span>Sync passed strict privacy gate: minimal payload transmitted.';
      toast('Cloud telemetry sync simulation successful.');
    } else {
      toast(`Sync blocked: ${result.message}`);
      note.innerHTML = `<span></span>${result.message}`;
    }
  } catch (err) {
    toast(`Sync error: ${err.message}`);
    note.innerHTML = `<span></span>${err.message}`;
  }
});

// 3D Visualizer Drag / Rotation
const stack = $('#deviceStack');
function setRotation() { stack.style.setProperty('--rot', `${rotation}deg`); }
$('#explodeRange').addEventListener('input', event => stack.style.setProperty('--gap', `${event.target.value}px`));
$('#rotateLeft').addEventListener('click', () => { rotation -= 12; setRotation(); });
$('#rotateRight').addEventListener('click', () => { rotation += 12; setRotation(); });
$('#rotateReset').addEventListener('click', () => {
  rotation = -35;
  $('#explodeRange').value = 18;
  stack.style.setProperty('--gap','18px');
  setRotation();
});

const scene = $('#scene');
scene.addEventListener('pointerdown', event => {
  dragStart = {x:event.clientX, rotation};
  scene.classList.add('dragging');
  scene.setPointerCapture(event.pointerId);
});
scene.addEventListener('pointermove', event => {
  if (!dragStart) return;
  rotation = dragStart.rotation + (event.clientX - dragStart.x) * .35;
  setRotation();
});
scene.addEventListener('pointerup', () => { dragStart = null; scene.classList.remove('dragging'); });
scene.addEventListener('pointercancel', () => { dragStart = null; scene.classList.remove('dragging'); });
$('#partHotspot').addEventListener('click', () => toast(`${$('#componentName').textContent}: hypothesis only, not confirmed.`));

// Privacy Inspector Modal
const dialog = $('#privacyDialog');
function openInspector() {
  let model='Not stored', symptom='Not stored';
  try {
    model = localStorage.getItem('repairlens.local.modelNumber') || 'Not stored';
    symptom = localStorage.getItem('repairlens.local.symptom') || 'Not stored';
  } catch (_) {}
  $('#localModelView').textContent = model;
  $('#localSymptomView').textContent = symptom;
  dialog.showModal();
}
$('#inspectLocal').addEventListener('click', openInspector);
$$('[data-open-privacy]').forEach(button => button.addEventListener('click', openInspector));
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

// Purge Local Data: Clears both localStorage AND IndexedDB (SEC-06 Fix)
$('#clearLocal').addEventListener('click', async () => {
  try {
    Object.keys(localStorage).filter(key => key.startsWith('repairlens.')).forEach(key => localStorage.removeItem(key));
    if (dbStore.db) {
      const tx = dbStore.db.transaction('DiagnosticsHistory', 'readwrite');
      tx.objectStore('DiagnosticsHistory').clear();
    }
    $('#localModelView').textContent = 'Not stored';
    $('#localSymptomView').textContent = 'Not stored';
    loadHistoryUI();
    toast('Local on-device vault and IndexedDB logs purged.');
  } catch (err) {
    logError('ClearLocal', err);
    toast('Error clearing local database.');
  }
});

// Render IndexedDB Triage History in UI
async function loadHistoryUI() {
  const container = $('#historyContainer');
  const emptyState = $('#historyEmpty');
  const list = $('#historyList');
  if (!container || !list) return;

  try {
    const records = await dbStore.getUnsynced();
    if (!records || records.length === 0) {
      if (emptyState) emptyState.hidden = false;
      list.hidden = true;
      list.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.hidden = true;
    list.hidden = false;
    list.innerHTML = records.slice(-5).reverse().map(rec => `
      <li style="padding: 0.75rem 1rem; border-bottom: 1px solid rgba(200,243,107,0.15); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <b style="color: #c8f36b; font-size: 0.9rem;">${escapeHtml(rec.category.toUpperCase())} · ${escapeHtml(rec.verdict?.risk || 'VERDICT')}</b>
          <p style="margin: 2px 0 0; font-size: 0.8rem; color: #888;">${new Date(rec.timestamp).toLocaleTimeString()} — ${escapeHtml(rec.symptom ? rec.symptom.substring(0, 50) + '...' : 'No symptoms text')}</p>
        </div>
        <span style="font-size: 0.75rem; background: #0e1e1a; border: 1px solid rgba(200,243,107,0.3); padding: 2px 6px; border-radius: 4px; color: #aaa;">LOCAL ONLY</span>
      </li>
    `).join('');
  } catch (err) {
    logError('LoadHistoryUI', err);
  }
}

// PWA Installation Handling
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstall = event;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('#installBtn').hidden = true;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[PWA] SW register notice:', err));
  });
}

// Local Storage & Cookie Consent Modal
window.addEventListener('DOMContentLoaded', () => {
  const consent = localStorage.getItem('repairlens.consent');
  const banner = document.getElementById('consentBanner');
  if (!consent && banner && typeof banner.showModal === 'function') {
    banner.showModal();
    document.getElementById('acceptConsent').addEventListener('click', () => {
      localStorage.setItem('repairlens.consent', 'true');
      banner.close();
    });
  }
});

// Structured Error Logger
function logError(context, error) {
  console.error(`[EcoDisassemble Error - ${new Date().toISOString()}] ${context}:`, error);
}

window.addEventListener('unhandledrejection', event => {
  logError('Unhandled Promise Rejection', event.reason);
});
