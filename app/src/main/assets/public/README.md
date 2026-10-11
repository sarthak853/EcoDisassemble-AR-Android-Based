# RepairLens prototype

A privacy-first electronic repair triage concept built as a dependency-free PWA.

## Run

From this directory:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `http://localhost:4173` (or the Arena live preview).

## Try the flow

1. Add any local image.
2. Choose an item category.
3. Enter a symptom such as:
   - Smartphone: `Charges only when the cable is held at an angle.`
   - Laptop: `The fan is noisy and the laptop becomes very hot.`
   - Headphones: `The left side cuts out when the cable moves.`
   - TV: `There is sound but the picture is black.`
   - Refrigerator: `Heavy frost forms and it is not cooling well.`
   - Microphone: `Static changes when the XLR cable moves.`
4. Optionally select a hazard.
5. Run private triage and inspect the result, 3D schematic, guide, and cloud payload.

## Privacy behavior

- The selected image is shown with an object URL and is never uploaded or persisted.
- Model number, symptom, and category are stored in browser `localStorage` only for this prototype. Production should use encrypted IndexedDB/OPFS.
- The inventory sync button is a simulation. There is no `fetch`/XHR call.
- The only eligible payload is an array of `{part_name, quantity}` records.

## Important limitation

The prototype uses transparent keyword rules, not a trained diagnostic model. Results are educational working hypotheses. Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the proposed production architecture, datasets, privacy design, AR plan, safety system, and roadmap.
