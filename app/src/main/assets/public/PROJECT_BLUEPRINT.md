# RepairLens — product and technical blueprint

**Status:** startup-oriented architecture + interactive PWA concept  
**Date:** 14 August 2026  
**Working name:** RepairLens (rename after trademark/domain review)

## 1. Product thesis

RepairLens helps a user photograph an electronic item, describe its symptoms, understand the most plausible fault areas, and choose between safe guided DIY and a technician. When an exact, licensed device model is available, the interface can highlight the suspected component in a 3D exploded view or AR overlay.

The differentiator is a strict privacy boundary:

- Image, EXIF, model number, symptom text, repair history, and personalization remain on the user's device.
- Only a replacement-part name and integer quantity are eligible for cloud inventory aggregation.
- Safety rules can override every model output.
- The system abstains when evidence is insufficient.

This is a **triage and repair-navigation product**, not a visual fault detector that can magically see through an enclosure.

## 2. Important feasibility limits

1. **A normal phone photo cannot confirm a hidden chip fault.** It can identify the product category, visible damage, corrosion, swelling, cracks, connector damage, and some surface anomalies. Internal electrical faults need measurements, diagnostic logs, thermal imaging, audio, or disassembly.
2. **Symptom text is often more useful than the exterior image.** Charging only at an angle, audio in one channel, blink codes, and temperature history are high-value evidence.
3. **3D pin-pointing is model-specific.** A reliable overlay needs a verified device match, a licensed/owned GLB asset, a parts ontology, and transforms linking a fault code to a mesh node. If any link is missing, show an explicitly generic schematic—not a fake exact model.
4. **Full model training in a PWA is not realistic.** Use quantized local inference plus lightweight local personalization (feedback memory, nearest-neighbor retrieval, or small adapter/calibration updates). Train base models in a controlled environment and export them for local inference.
5. **“Part name only” can still reveal the model.** An exact part such as an model-specific display assembly or vendor SKU often identifies the compatible device. The business must choose between generic cloud demand aggregation and exact fulfillment. The latter weakens the stated model-number privacy promise.
6. **Browser storage is local, not automatically confidential.** Same-origin JavaScript and a successful XSS attack can read it. Production needs a strict CSP, no untrusted third-party scripts, encryption with a user-held secret, and a clear delete/export flow.

## 3. Recommended product scope

The UI may accept several categories, but each category should use its own safety policy, evidence checklist, model, guide catalog, and evaluation set.

| Launch track | Product behavior | Why |
|---|---|---|
| Headphones and microphones | Guided external checks; selected modular replacements | Lower voltage and smaller catalog; best first end-to-end vertical |
| Smartphones and laptops | Visual triage, battery safety, model-specific guides for covered devices | Strong demand and repair content, but battery/adhesive/data risks |
| TVs | External triage and technician handoff only at first | Mains voltage and charged capacitors make internal DIY unsafe |
| Refrigerators | External checks and technician handoff only at first | Mains, water, heavy equipment, refrigerants, and sealed systems |

A “multi-category” startup should therefore mean **one shared platform with specialist plug-ins**, not one universal model trained on mixed internet images.

## 4. User journey

1. User chooses a category or takes a photo for local category suggestion.
2. Local preflight checks blur, glare, framing, and whether a label/model photo is useful.
3. User enters symptoms and hazard signals: swelling, smoke/sparks, burning odor, liquid, abnormal heat.
4. Deterministic safety gate either stops the flow or allows non-invasive checks.
5. Local multimodal pipeline ranks possible fault paths and explains the evidence.
6. The product asks one or two discriminating follow-up questions or diagnostics.
7. Repairability engine produces one of:
   - `STOP — ISOLATE / EMERGENCY GUIDANCE`
   - `TECHNICIAN REQUIRED`
   - `ADVANCED DIY WITH VERIFIED GUIDE`
   - `GUIDED DIY`
   - `INSUFFICIENT EVIDENCE`
8. If a verified 3D asset exists, the suspected part mesh is highlighted. Otherwise, a generic layered schematic is shown.
9. The user confirms a replacement part locally. Only an allow-listed cloud manifest can cross the privacy gate.
10. The user records the outcome locally: fixed/not fixed, actual part, technician diagnosis, and notes. This improves only local retrieval/personalization unless a separate explicit research consent program is created.

## 5. Reference architecture

```text
PHONE / DESKTOP BROWSER — TRUSTED LOCAL ZONE

Camera / file
   │
   ├─ image preflight ── EXIF removal in memory ── category / visible damage
   │
Symptom form ── local text encoder / rules / retrieval
   │
Hazard flags ── deterministic safety policy  <── signed policy updates
   │
   ├─ specialist category pipeline
   │     ├─ anomaly / damage segmentation
   │     ├─ symptom-to-fault retrieval
   │     ├─ diagnostic-question selector
   │     └─ calibrated hypothesis ranker + abstention
   │
   ├─ repairability engine ── local guide catalog
   ├─ model registry ── GLB mesh + component ontology ── 3D / AR viewer
   └─ encrypted IndexedDB / OPFS
             │
       privacy allow-list
             │ only [{part_name, quantity}]
             ▼
CLOUD — UNTRUSTED MINIMAL ZONE
API schema validation ── aggregate upsert by generic part name
(no image, model, symptom, account, device ID, raw event, or payload log)
```

### Production client

- **PWA:** TypeScript, React, Vite, Workbox; keep inference and image processing in Web Workers.
- **Local inference:** ONNX Runtime Web with WebGPU when available, WASM fallback; use quantized models and benchmark low-memory Android devices.
- **Text/vision options:** Transformers.js or direct ONNX Runtime. Do not load model files from a third-party runtime at request time; pin, self-host, checksum, and cache them.
- **Local data:** IndexedDB for structured records; OPFS for larger encrypted blobs/model packs. Use Web Crypto AES-GCM with a key derived from a user passphrase that is not persisted.
- **3D:** Three.js or Babylon.js with compressed GLB (`KHR_draco_mesh_compression` / meshopt), named component nodes, and a local mapping table.
- **AR:** WebXR as progressive enhancement on supported browsers; always retain a non-AR 3D viewer. WebXR support remains uneven, so do not make it the only interface.
- **Packaging later:** Capacitor or a native Android shell can provide ARCore, better file protection, and more predictable on-device ML while reusing most PWA UI.

### Minimal cloud

For the strict interpretation of the privacy requirement, do **not** create user accounts in the cloud. Store only aggregate demand:

```sql
CREATE TABLE part_demand (
  part_name TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0)
);
```

Accept only this JSON body:

```json
[
  {"part_name": "USB-C charging-port assembly", "quantity": 1}
]
```

The gateway should reject extra keys, long strings, free-form comments, decimals, negative values, nested metadata, and excessive batches. Disable request-body logging and tracing capture. Infrastructure may still process IP address, TLS, and abuse-control data; document retention honestly. If even transient metadata is unacceptable, a normal public web endpoint is not sufficient.

**Privacy/fulfillment conflict:** exact inventory SKUs can reveal the device model. Generic part taxonomy preserves more privacy but cannot directly fulfill an order. Treat procurement as a separate, explicit disclosure flow rather than silently changing the cloud contract.

## 6. Local data model

```text
Inspection
- local_id (random, never synced)
- category
- model_number
- symptom_text
- hazard_flags[]
- image_blob_ref / derived embedding ref
- created_at
- model_versions[]
- ranked_hypotheses[]
- selected_guide_id
- outcome

DeviceModel
- local_model_key
- manufacturer / family / regional variant
- identifiers[]
- glb_asset_ref
- guide_refs[]
- component_map_version

LocalFeedback
- inspection_id
- suggested_fault
- confirmed_fault
- action_taken
- fixed_boolean
- technician_note
```

Encrypt records at rest. Keep search indexes minimal because an unencrypted index can reveal the same information as the underlying records. Offer `Export encrypted archive`, `Delete one inspection`, and `Delete everything`.

## 7. ML and reasoning pipeline

### 7.1 Do not train a single end-to-end “diagnosis model” first

A safer, auditable pipeline is:

1. **Input quality model:** blur, darkness, glare, framing, unsupported item.
2. **Category detector:** smartphone/laptop/headphone/TV/fridge/microphone; abstain on unsupported categories.
3. **Visible evidence model:** crack, corrosion, bent connector, swelling/lift, burn mark, missing component, liquid residue. Use segmentation where localization matters.
4. **Local OCR/model identification:** read labels locally, then match against a signed local model registry. Always ask the user to confirm.
5. **Symptom encoder + retrieval:** retrieve fault trees, service bulletins, owner-manual checks, and verified guides for the local device/category.
6. **Safety policy engine:** deterministic rules with versioning and expert review. ML cannot lower a deterministic risk level.
7. **Hypothesis ranker:** combine visual evidence, text evidence, category priors, diagnostic answers, and model coverage.
8. **Calibration/abstention:** output evidence bands and an explicit unknown state, not decorative percentages.
9. **Repairability engine:** tools, skill, voltage, stored energy, battery, refrigerant, water, calibration, data-loss risk, guide coverage, and part availability.
10. **3D resolver:** `device_model -> component ontology ID -> GLB node transform`.

### 7.2 Local personalization

Keep a local case memory of embeddings and confirmed outcomes. At inference time, retrieve similar local cases and rerank suggestions. This is useful “local learning” without risky full fine-tuning.

Possible later options:

- Update a tiny calibration layer or adapter locally when enough confirmed examples exist.
- Distill category models into a small shared backbone plus category heads.
- Ship signed model/policy updates as public static assets.

Federated learning sends gradients/updates that may leak information and violates a literal “only part name and quantity leave the device” policy. Do not add it without a separate, informed opt-in and a revised threat model.

## 8. Dataset plan and licensing gate

“You can use any dataset we find” is not safe for a startup. Every source needs provenance, license, consent, allowed commercial use, redistribution terms, deletion handling, and train/test leakage review.

| Source | Useful for | Limit | Commercial action |
|---|---|---|---|
| **VisA (Amazon Science)** | PCB/component anomaly pretraining; pixel labels | Mostly industrial inspection, not consumer field diagnosis | Official repository states CC BY 4.0; preserve attribution and verify the release files |
| **DsPCBSD+** | PCB surface-defect detection | Manufacturing images do not represent phone-camera repair photos | Paper/dataset is CC BY 4.0; verify exact archive and attribution |
| **DeepPCB** | PCB defect baseline | Artificial defects, line-scan imagery; repository text also says research-only despite an MIT license file | Treat as rights-conflicted until counsel/owner confirms commercial training rights |
| **MVTec AD / AD 2** | Anomaly-detection benchmarking | Not consumer diagnosis; newer release is non-commercial ShareAlike | Research evaluation only unless separately licensed |
| **iFixit guides/API** | Repair steps, part taxonomy, teardown structure | Guide content is CC BY-NC-SA; commercial and model-training use requires permission | Contact iFixit for a commercial/training license before startup use |
| **Manufacturer owner/service manuals** | Safe checks, exact procedures | Copyright, region/model variation, restricted service content | Use licensed feeds, partnerships, or link to official public documents |
| **Your own repair dataset** | Real symptoms, phone photos, measurements, outcomes | Expensive; must prevent PII and unsafe annotation | Primary production asset; collect with explicit contributor and technician agreements |

Official references:

- VisA repository and license: https://github.com/amazon-science/spot-diff
- DsPCBSD+ publication: https://www.nature.com/articles/s41597-024-03656-8
- DeepPCB repository: https://github.com/youtang1993/DeepPCB
- MVTec AD 2: https://www.mvtec.com/company/research/datasets/mvtec-ad-2
- iFixit API: https://www.ifixit.com/api/2.0/doc/Guides
- iFixit content licensing: https://about.ifixit.com/Info/Licensing

### Dataset you actually need to build

Create a technician-verified schema around **cases**, not loose images:

```text
case_id, category, device_model_local_key, image_views[], symptom_answers,
hazard_flags, non-invasive_tests, measurements, disassembly_stage,
visible_damage_masks, suspected_component, confirmed_root_cause,
part_replaced, outcome, technician_confidence, annotator, license
```

Capture hard negatives: cosmetic damage with no fault, dirty but working ports, software issues, wrong accessories, and photos where the correct answer is “cannot determine.” Split by device family and repair shop to prevent leakage.

Use synthetic renders only from owned/licensed CAD/GLB assets. Domain-randomize lighting, camera, clutter, wear, and occlusion, then validate against real phone photographs.

## 9. 3D and AR design

### Asset contract

Each supported model needs:

```json
{
  "model_key": "local-only-key",
  "asset_version": "1.2.0",
  "glb": "asset-pack-ref",
  "components": {
    "power.battery": {"node": "BATTERY_PACK", "anchor": [0.12, 0.48, 0.03]},
    "io.charge_port": {"node": "USB_C_SUBBOARD", "anchor": [0.50, -0.88, 0.02]}
  }
}
```

A component highlight must display its scope:

- **Exact model + verified asset**
- **Same-family approximation**
- **Generic category schematic**

Never label an approximate render as the user's exact internals.

### Privacy issue with asset delivery

Requesting `model-x.glb` from a CDN reveals the model through the URL/access log. Strict options are:

1. User downloads a large offline asset pack containing many models.
2. The app ships category packs and accepts group-level leakage.
3. Native installation bundles selected catalogs.
4. Use a separate explicit consent for model-specific asset download.

For the first PWA, preload a small public demo pack and perform all model selection locally.

### AR sequence

1. Detect supported device and ask user to confirm exact model.
2. Use printed/known reference points or feature matching for pose estimation.
3. Lock to an external enclosure coordinate system.
4. Render the internal component as a translucent overlay with uncertainty radius.
5. Offer an exploded 3D fallback when pose quality drops.
6. Do not guide live disassembly of powered/high-risk equipment.

## 10. Safety system

### Non-negotiable stop conditions

- Swollen, hissing, smoking, leaking, punctured, or abnormally hot lithium battery
- Sparks, burning odor, melted mains parts, exposed conductors
- Liquid with uncertain power state
- TV internal power-supply access
- Refrigerator compressor/refrigerant/sealed-system work
- Microwave ovens, CRTs, UPS systems, high-voltage power supplies, solar inverters, and EV systems should initially be unsupported

### Repairability decision inputs

- voltage/stored-energy class
- battery chemistry and access
- refrigerant/pressure/water
- part soldered vs modular
- tool and calibration requirements
- data-loss/security risk
- enclosure seal and water-resistance restoration
- verified guide for exact revision
- user-declared experience
- evidence quality and diagnosis confidence

When inputs conflict, choose the safer result. The safety policy is signed, versioned, unit-tested, and reviewed by electrical/appliance repair experts and legal counsel.

## 11. Validation and metrics

Do not optimize only top-1 accuracy.

| Area | Metric |
|---|---|
| Safety | Recall on stop conditions; false-safe rate; unsafe-step audit count |
| Diagnosis | Top-1/top-3 component-family recall after confirmed repair |
| Calibration | Expected calibration error; selective risk vs abstention coverage |
| Localization | IoU/pointing-game score only where ground-truth visible region exists |
| Repair guidance | Successful fix, damage-free completion, escalation rate, return rate |
| Privacy | Automated network egress test; extra-field rejection; log-scrubbing audit |
| Performance | P50/P95 model load and inference on low/mid/high-tier phones; memory crashes |
| Fairness/robustness | Lighting, skin tone in incidental hands, language, camera quality, device age |

Before public DIY guidance, run red-team tests with technicians, product-safety experts, novice users, and deliberately misleading inputs.

## 12. Roadmap

### Phase 0 — 0 to 6 weeks: concept validation

- Use the included PWA to test the journey.
- Interview 20–30 repair technicians and 30–50 users.
- Finalize hazard taxonomy and data consent.
- Choose 20 headphone/microphone models and 10 common fault paths.
- Secure at least one legal repair-content source.

**Exit:** users understand hypothesis vs diagnosis; experts approve safety language; data rights are documented.

### Phase 1 — 2 to 4 months: vertical MVP

- PWA with local capture, symptom flow, local retrieval, deterministic safety gate.
- Headphones/microphones plus external smartphone triage.
- 5–10 verified model-specific GLBs or owned simplified diagrams.
- Encrypted local case history and delete/export.
- Generic part-demand cloud endpoint with egress/privacy tests.

**Exit:** technician-verified top-3 usefulness, zero known critical false-safe cases in acceptance set, acceptable low-end phone performance.

### Phase 2 — 4 to 8 months: measured diagnosis support

- Add guided non-invasive tests and peripheral sensor data.
- Smartphone/laptop specialist models and model registry.
- Outcome collection from partner shops.
- Calibration/abstention dashboard using de-identified, consented research data in a separate governance environment.

### Phase 3 — 8 to 15 months: catalog and native features

- Native Android shell for better ARCore/on-device ML.
- Licensed guide and parts partnerships.
- Offline asset/model packs.
- Technician handoff package generated locally and shared only by user action.
- TV/fridge remain external-triage-first until category safety evidence is strong.

## 13. Initial team

- Product lead with repair/right-to-repair domain knowledge
- Frontend/PWA engineer with WebGPU/Web Workers
- ML engineer for vision, retrieval, calibration, and model optimization
- Backend/security engineer for privacy gate and supply integration
- 3D/AR engineer or technical artist
- Data/ML operations lead
- Contract electrical/appliance safety experts and repair technicians
- Privacy/product counsel and content-licensing counsel

A credible startup version is not a one-person “train a model on Kaggle” project. A solo founder can validate the workflow and one category, then recruit the specialist team.

## 14. Decisions to make next

1. Define the first 20 supported models and 10 fault paths.
2. Decide whether the cloud stores generic demand or exact purchasable SKUs.
3. Choose the exact local-data threat model and recovery method.
4. Secure commercial rights to repair content and 3D assets.
5. Define the technician-confirmed case annotation workflow.
6. Write the first safety policy with expert sign-off.
7. Replace the demo rules engine with a local retrieval baseline before adding a vision-language model.

## 15. What is implemented in the accompanying prototype

- Responsive installable PWA shell with camera/file capture
- Photo kept in tab memory; no upload call
- Multi-category symptom and hazard intake
- Transparent rule-based hypothesis ranking
- Safety-first DIY/technician verdict
- Interactive exploded component schematic with hotspot
- Safe next-step guide generation
- Exact replacement-manifest payload preview
- Local model/symptom demo storage and delete control
- Offline service-worker cache

It intentionally does **not** claim real visual diagnosis, use a remote model, transmit data, or display an exact device interior.
