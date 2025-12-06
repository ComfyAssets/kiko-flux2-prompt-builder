import { app } from "/scripts/app.js";

const EXTENSION_ID = "kiko-flux2-prompt-builder";
const NODE_NAME = "KikoFlux2PromptBuilder";
const ASSET_BASE = `/extensions/${EXTENSION_ID}`;
const API_BASE = `/${EXTENSION_ID}`;

const dataCache = {
  loaded: false,
  presets: {},
  styles: {},
  cameras: {},
  lighting: {},
  mood: {},
  composition: {},
};

const defaultState = () => ({
  preset: "custom",
  prompt: "",
  style: "",
  cameraAngle: "",
  cameraShot: "",
  cameraLens: "",
  cameraAperture: "",
  cameraISO: "",
  cameraFocus: "",
  cameraModel: "",
  lighting: "",
  colors: [],
  colorMood: "",
  composition: "",
  includeEmpty: false,
  numericLens: true,
});

async function loadData() {
  if (dataCache.loaded) return dataCache;
  const names = ["presets", "styles", "cameras", "lighting", "mood", "composition"];
  for (const name of names) {
    // Try API endpoint first (more reliable), fallback to static file
    let res = await fetch(`${API_BASE}/data/${name}.json`);
    if (!res.ok) {
      // Fallback to static file path
      res = await fetch(`${ASSET_BASE}/data/${name}.json`);
    }
    if (!res.ok) throw new Error(`Failed to load ${name}`);
    dataCache[name] = await res.json();
  }
  dataCache.loaded = true;
  return dataCache;
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state || defaultState()));
}

function coercePalette(colors) {
  if (Array.isArray(colors)) return colors.map((c) => `${c}`.trim()).filter(Boolean);
  if (typeof colors === "string") return colors.split(",").map((c) => c.trim()).filter(Boolean);
  return [];
}

function applyPresetDefaults(state) {
  if (!state.preset || state.preset === "custom") return state;
  const preset = dataCache.presets?.[state.preset];
  if (!preset) return state;

  const next = cloneState(state);
  next.prompt = preset.prompt || "";
  next.style = preset.style || "";

  const cam = preset.camera || {};
  next.cameraAngle = cam.angle || "";
  next.cameraShot = cam.shot || "";
  next.cameraLens = cam.lens || "";
  next.cameraAperture = cam.aperture || "";
  next.cameraISO = cam.iso || "";
  next.cameraFocus = cam.focus || "";
  next.cameraModel = cam.model || "";

  next.lighting = preset.lighting || "";
  const colors = preset.colors || {};
  if (Array.isArray(colors.palette)) {
    next.colors = [...colors.palette];
  }
  next.colorMood = colors.mood || "";
  next.composition = preset.composition || "";
  return next;
}

function buildData(state) {
  const includeEmpty = !!state.includeEmpty;
  const numericLens = state.numericLens !== false;

  const camera = {};
  if (state.cameraAngle || includeEmpty) camera.angle = state.cameraAngle;
  if (state.cameraShot || includeEmpty) camera.distance = state.cameraShot;
  if (state.cameraLens || includeEmpty) {
    if (numericLens) {
      const digits = `${state.cameraLens}`.replace(/[^0-9]/g, "");
      if (digits) camera["lens-mm"] = parseInt(digits, 10);
      else camera.lens = state.cameraLens;
    } else {
      camera.lens = state.cameraLens;
    }
  }
  if (state.cameraAperture || includeEmpty) camera["f-number"] = state.cameraAperture;
  if (state.cameraISO || includeEmpty) {
    const isoNum = parseInt(state.cameraISO, 10);
    camera.ISO = Number.isNaN(isoNum) ? state.cameraISO : isoNum;
  }
  if (state.cameraFocus || includeEmpty) camera.focus = state.cameraFocus;

  const data = {};
  if (state.prompt || includeEmpty) data.prompt = state.prompt;
  if (state.style || includeEmpty) data.style = state.style;
  if (Object.keys(camera).length || includeEmpty) data.camera = camera;
  if (state.cameraModel) data.film_stock = state.cameraModel;
  if (state.lighting || includeEmpty) data.lighting = state.lighting;

  const palette = coercePalette(state.colors);
  if (palette.length || state.colorMood || includeEmpty) {
    data.colors = {};
    if (palette.length || includeEmpty) data.colors.palette = palette;
    if (state.colorMood || includeEmpty) data.colors.mood = state.colorMood;
  }

  if (state.composition || includeEmpty) data.composition = state.composition;
  return data;
}

function buildText(data) {
  const parts = [];
  if (data.prompt) parts.push(data.prompt);
  if (data.style) parts.push(`Style: ${data.style}`);

  const camera = data.camera || {};
  if (Object.keys(camera).length) {
    const desc = [];
    if (camera.angle) desc.push(`${camera.angle} angle`);
    if (camera.distance) desc.push(camera.distance);
    if (camera["lens-mm"] !== undefined) desc.push(`${camera["lens-mm"]}mm lens`);
    if (camera.lens) desc.push(`${camera.lens} lens`);
    if (camera["f-number"]) desc.push(camera["f-number"]);
    if (desc.length) parts.push(`Camera: ${desc.join(", ")}`);
    if (camera.focus) parts.push(`Focus: ${camera.focus}`);
  }

  if (data.film_stock) parts.push(`${data.film_stock}`);
  if (data.lighting) parts.push(`Lighting: ${data.lighting}`);

  const colors = data.colors || {};
  if (colors.palette?.length) parts.push(`Colors: ${colors.palette.join(", ")}`);
  if (colors.mood) parts.push(`Mood: ${colors.mood}`);
  if (data.composition) parts.push(`Composition: ${data.composition}`);
  return parts.join(". ");
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function ensureStyles() {
  if (document.getElementById("kiko-builder-styles")) return;
  const style = document.createElement("style");
  style.id = "kiko-builder-styles";
  style.textContent = `
  /* Custom Scrollbar - Webkit */
  .kiko-overlay ::-webkit-scrollbar { width: 10px; height: 10px; }
  .kiko-overlay ::-webkit-scrollbar-track { background: #1a1a2e; border-radius: 5px; }
  .kiko-overlay ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%); border-radius: 5px; border: 2px solid #1a1a2e; }
  .kiko-overlay ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%); }

  .kiko-overlay { position: fixed; inset: 0; background: rgba(12,12,14,0.75); backdrop-filter: blur(6px); display: none; align-items: center; justify-content: center; z-index: 9999; font-family: 'Segoe UI', system-ui, sans-serif; }
  .kiko-overlay.show { display: flex; }

  .kiko-node { background: #2a2a2a; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); width: min(420px, 94vw); max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }

  .kiko-node-header { background: linear-gradient(135deg, #5a4fcf 0%, #7c3aed 100%); padding: 10px 14px; font-weight: 600; font-size: 13px; color: white; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .kiko-node-header-left { display: flex; align-items: center; gap: 8px; }
  .kiko-node-header-icon { width: 18px; height: 18px; background: rgba(255,255,255,0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; }
  .kiko-close-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; }
  .kiko-close-btn:hover { background: rgba(255,255,255,0.3); }

  .kiko-node-body { padding: 12px; overflow-y: auto; flex: 1; }

  .kiko-field-group { margin-bottom: 12px; }
  .kiko-field-label { font-size: 11px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
  .kiko-field-label .kiko-hint { font-size: 10px; color: #666; text-transform: none; letter-spacing: 0; }

  .kiko-field-input { width: 100%; background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 4px; padding: 8px 10px; color: #e0e0e0; font-size: 12px; transition: border-color 0.2s; box-sizing: border-box; }
  .kiko-field-input:focus { outline: none; border-color: #7c3aed; }
  .kiko-field-input::placeholder { color: #555; }
  textarea.kiko-field-input { min-height: 80px; resize: vertical; font-family: inherit; line-height: 1.5; }
  select.kiko-field-input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
  select.kiko-field-input optgroup { background: #1e1e1e; color: #888; font-style: normal; font-weight: 600; }
  select.kiko-field-input option { background: #1e1e1e; color: #e0e0e0; padding: 4px; }

  .kiko-sub-section { background: #252525; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
  .kiko-sub-section-title { font-size: 11px; color: #7c3aed; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .kiko-sub-section-title::before { content: ''; width: 8px; height: 8px; background: #7c3aed; border-radius: 2px; }

  .kiko-inline-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }

  /* Style selector with edit toggle */
  .kiko-style-selector { display: flex; gap: 4px; }
  .kiko-style-selector .kiko-style-dropdown { flex: 1; }
  .kiko-style-selector .kiko-style-text { flex: 1; display: none; }
  .kiko-style-selector.edit-mode .kiko-style-dropdown { display: none; }
  .kiko-style-selector.edit-mode .kiko-style-text { display: block; }
  .kiko-edit-toggle { background: #333; border: 1px solid #555; border-radius: 4px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #888; transition: all 0.2s; flex-shrink: 0; }
  .kiko-edit-toggle:hover { background: #444; border-color: #7c3aed; color: #ccc; }
  .kiko-style-selector.edit-mode .kiko-edit-toggle { background: #7c3aed; border-color: #7c3aed; color: white; }
  .kiko-edit-toggle svg { width: 14px; height: 14px; pointer-events: none; }

  /* Combo input */
  .kiko-combo-input { position: relative; }
  .kiko-combo-input input { padding-right: 30px; }
  .kiko-combo-input .kiko-dropdown-toggle { position: absolute; right: 1px; top: 1px; bottom: 1px; width: 28px; background: #2a2a2a; border: none; border-left: 1px solid #3a3a3a; border-radius: 0 3px 3px 0; cursor: pointer; color: #888; font-size: 10px; }
  .kiko-combo-input .kiko-dropdown-toggle:hover { background: #333; color: #aaa; }
  .kiko-combo-input .kiko-dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 4px; margin-top: 2px; max-height: 200px; overflow-y: auto; z-index: 100; display: none; }
  .kiko-combo-input .kiko-dropdown-menu.open { display: block; }
  .kiko-combo-input .kiko-dropdown-menu .kiko-option { padding: 6px 10px; font-size: 11px; color: #ccc; cursor: pointer; }
  .kiko-combo-input .kiko-dropdown-menu .kiko-option:hover { background: #2a2a2a; color: #fff; }
  .kiko-combo-input .kiko-dropdown-menu .kiko-option-header { padding: 4px 10px; font-size: 10px; color: #666; text-transform: uppercase; background: #252525; pointer-events: none; }

  /* Image picker section */
  .kiko-image-drop-zone { position: relative; background: #1a1a1a; border: 2px dashed #444; border-radius: 6px; min-height: 100px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; overflow: hidden; margin-bottom: 8px; }
  .kiko-image-drop-zone:hover { border-color: #7c3aed; background: #1e1e2a; }
  .kiko-image-drop-zone.drag-over { border-color: #7c3aed; background: #252535; border-style: solid; }
  .kiko-image-drop-zone.has-image { cursor: crosshair; border-style: solid; border-color: #3a3a3a; }
  .kiko-image-drop-zone.has-image:hover { border-color: #7c3aed; }
  .kiko-drop-zone-content { text-align: center; padding: 15px; }
  .kiko-drop-icon { font-size: 28px; margin-bottom: 6px; }
  .kiko-drop-text { font-size: 11px; color: #888; margin-bottom: 2px; }
  .kiko-drop-hint { font-size: 10px; color: #555; }
  .kiko-image-canvas { display: none; max-width: 100%; max-height: 200px; border-radius: 4px; }
  .kiko-image-drop-zone.has-image .kiko-image-canvas { display: block; }
  .kiko-image-drop-zone.has-image .kiko-drop-zone-content { display: none; }
  .kiko-clear-image-btn { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0, 0, 0, 0.7); border: 1px solid #555; color: #ccc; font-size: 14px; cursor: pointer; display: none; align-items: center; justify-content: center; transition: all 0.2s; line-height: 1; }
  .kiko-clear-image-btn:hover { background: #ff4444; border-color: #ff4444; color: white; }
  .kiko-image-drop-zone.has-image .kiko-clear-image-btn { display: flex; }
  .kiko-picked-color-preview { display: none; align-items: center; gap: 8px; margin-bottom: 8px; padding: 6px 8px; background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 4px; font-size: 11px; color: #888; }
  .kiko-picked-color-preview.visible { display: flex; }
  .kiko-preview-swatch { width: 24px; height: 24px; border-radius: 4px; border: 2px solid #555; background: #000; flex-shrink: 0; }

  /* Color palette */
  .kiko-color-palette { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .kiko-color-chip { display: flex; align-items: center; gap: 4px; background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 4px; padding: 4px 6px; }
  .kiko-color-chip input[type="color"] { width: 22px; height: 22px; padding: 0; border: 1px solid #555; border-radius: 3px; cursor: pointer; background: transparent; }
  .kiko-color-chip input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  .kiko-color-chip input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }
  .kiko-color-chip input[type="text"] { background: transparent; border: none; color: #e0e0e0; width: 90px; font-size: 11px; }
  .kiko-color-chip input[type="text"]:focus { outline: none; }
  .kiko-eyedropper-btn { background: #333; border: 1px solid #555; border-radius: 3px; width: 22px; height: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #ccc; transition: all 0.2s; flex-shrink: 0; }
  .kiko-eyedropper-btn:hover:not(:disabled) { background: #444; border-color: #7c3aed; color: #fff; }
  .kiko-eyedropper-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .kiko-eyedropper-btn svg { width: 12px; height: 12px; pointer-events: none; }
  .kiko-remove-color-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
  .kiko-remove-color-btn:hover { color: #ff6b6b; }
  .kiko-add-color-btn { background: #333; border: 1px dashed #555; border-radius: 4px; padding: 4px 10px; font-size: 11px; color: #888; cursor: pointer; transition: all 0.2s; }
  .kiko-add-color-btn:hover { background: #3a3a3a; border-color: #7c3aed; color: #aaa; }

  /* Toggle switch */
  .kiko-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
  .kiko-toggle-label { font-size: 11px; color: #aaa; }
  .kiko-toggle-switch { position: relative; width: 36px; height: 20px; }
  .kiko-toggle-switch input { opacity: 0; width: 0; height: 0; }
  .kiko-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: 0.3s; border-radius: 20px; }
  .kiko-toggle-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #888; transition: 0.3s; border-radius: 50%; }
  .kiko-toggle-switch input:checked + .kiko-toggle-slider { background-color: #7c3aed; }
  .kiko-toggle-switch input:checked + .kiko-toggle-slider:before { transform: translateX(16px); background-color: white; }

  /* Preset section */
  .kiko-preset-section { margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px solid #3a3a3a; }

  /* Footer */
  .kiko-node-footer { padding: 10px 12px; border-top: 1px solid #3a3a3a; display: flex; justify-content: flex-end; gap: 8px; background: #222; }
  .kiko-btn { padding: 8px 16px; border-radius: 4px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .kiko-btn-primary { background: linear-gradient(135deg, #5a4fcf 0%, #7c3aed 100%); color: white; }
  .kiko-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
  .kiko-btn-secondary { background: #333; color: #ccc; border: 1px solid #444; }
  .kiko-btn-secondary:hover { background: #444; color: #fff; }

  /* JSON preview */
  .kiko-json-preview { background: #0d0d0d; border: 1px solid #333; border-radius: 4px; padding: 10px; font-family: 'Fira Code', 'Consolas', monospace; font-size: 10px; color: #a0e0a0; white-space: pre-wrap; word-break: break-word; max-height: 150px; overflow-y: auto; line-height: 1.5; margin-top: 12px; }
  .kiko-json-preview .kiko-json-key { color: #9cdcfe; }
  .kiko-json-preview .kiko-json-string { color: #ce9178; }
  .kiko-json-preview .kiko-json-number { color: #b5cea8; }
  `;
  document.head.appendChild(style);
}

function findWidget(node, name) {
  return (node.widgets || []).find((w) => w.name === name);
}

function syncWidgets(node, state) {
  const mapping = {
    prompt: "prompt",
    preset: "preset",
    style: "style",
    camera_angle: "cameraAngle",
    camera_shot: "cameraShot",
    camera_lens: "cameraLens",
    camera_aperture: "cameraAperture",
    camera_iso: "cameraISO",
    camera_focus: "cameraFocus",
    camera_model: "cameraModel",
    lighting: "lighting",
    color_palette: "colors",
    color_mood: "colorMood",
    composition: "composition",
    include_empty_fields: "includeEmpty",
    numeric_lens_format: "numericLens",
    builder_payload: null,
  };

  Object.entries(mapping).forEach(([widgetName, stateKey]) => {
    const widget = findWidget(node, widgetName);
    if (!widget) return;
    if (stateKey === null) {
      widget.value = JSON.stringify(state);
      return;
    }
    if (stateKey === "colors") {
      widget.value = coercePalette(state.colors).join(", ");
      return;
    }
    const value = state[stateKey];
    widget.value = typeof value === "boolean" ? value : value ?? "";
  });
}

function attachBuilder(nodeType) {
  const origOnNodeCreated = nodeType.prototype.onNodeCreated;
  nodeType.prototype.onNodeCreated = function () {
    origOnNodeCreated?.apply(this, arguments);
    setupNode(this);
  };

  const origSerialize = nodeType.prototype.serialize;
  nodeType.prototype.serialize = function () {
    const data = origSerialize ? origSerialize.apply(this, arguments) : {};
    data.kiko_payload = JSON.stringify(this.kikoState || {});
    return data;
  };

  const origConfigure = nodeType.prototype.onConfigure;
  nodeType.prototype.onConfigure = function (info) {
    try {
      if (info?.kiko_payload) {
        const parsed = JSON.parse(info.kiko_payload);
        if (parsed && typeof parsed === "object") this.kikoState = parsed;
      }
    } catch (err) {
      console.warn("Kiko builder: failed to restore state", err);
    }
    origConfigure?.apply(this, arguments);
  };
}

function setupNode(node) {
  node.kikoState = node.kikoState || defaultState();
  if (!node.builderButton) {
    node.builderButton = node.addWidget?.("button", "Open Builder", "open", () => openBuilder(node));
  }
  if (!findWidget(node, "builder_payload") && node.addWidget) {
    node.addWidget("text", "builder_payload", "", () => {});
  }
}

// Camera settings dropdown options
const cameraOptions = {
  angle: {
    "Common Angles": [
      { value: "eye level", label: "eye level (natural)" },
      { value: "low angle", label: "low angle (powerful)" },
      { value: "high angle", label: "high angle (diminishing)" },
      { value: "bird's-eye", label: "bird's-eye (architectural)" },
      { value: "worm's-eye", label: "worm's-eye (dramatic)" },
    ],
    "Subtle Variations": [
      { value: "slightly low", label: "slightly low" },
      { value: "slightly high", label: "slightly high" },
    ],
    "Creative Angles": [
      { value: "Dutch angle", label: "Dutch angle (tilted)" },
      { value: "over-the-shoulder", label: "over-the-shoulder (intimate)" },
      { value: "overhead flat lay", label: "overhead flat lay" },
      { value: "ground level", label: "ground level" },
      { value: "dynamic angle", label: "dynamic angle" },
    ],
  },
  shot: {
    "Standard Shots": [
      { value: "extreme close-up", label: "extreme close-up" },
      { value: "close-up", label: "close-up" },
      { value: "medium close-up", label: "medium close-up" },
      { value: "medium shot", label: "medium shot" },
      { value: "medium full shot", label: "medium full shot" },
      { value: "full body", label: "full body" },
      { value: "wide shot", label: "wide shot" },
    ],
    "Specialized": [
      { value: "macro detail", label: "macro detail" },
      { value: "tight detail", label: "tight detail" },
      { value: "product close-up", label: "product close-up" },
      { value: "intimate close-up", label: "intimate close-up" },
    ],
    "Motion Shots": [
      { value: "tracking shot", label: "tracking shot" },
      { value: "action shot", label: "action shot" },
      { value: "full body action", label: "full body action" },
    ],
  },
  lens: {
    "Wide (Dramatic)": [
      { value: "14mm", label: "14mm (ultra-wide)" },
      { value: "24mm", label: "24mm (wide)" },
      { value: "28mm", label: "28mm (wide)" },
    ],
    "Natural": [
      { value: "35mm", label: "35mm (natural)" },
      { value: "50mm", label: "50mm (standard)" },
    ],
    "Portrait / Telephoto": [
      { value: "70mm", label: "70mm" },
      { value: "85mm", label: "85mm (portrait)" },
      { value: "100mm", label: "100mm" },
      { value: "135mm", label: "135mm (telephoto)" },
      { value: "200mm", label: "200mm (telephoto)" },
    ],
    "Specialty": [
      { value: "100mm macro", label: "100mm macro" },
      { value: "fisheye", label: "fisheye" },
      { value: "tilt-shift", label: "tilt-shift" },
    ],
  },
  aperture: {
    "Shallow DOF (Blurred BG)": [
      { value: "f/1.2", label: "f/1.2 (very shallow)" },
      { value: "f/1.4", label: "f/1.4 (shallow)" },
      { value: "f/1.8", label: "f/1.8" },
      { value: "f/2.0", label: "f/2.0" },
      { value: "f/2.8", label: "f/2.8 (portrait)" },
    ],
    "Moderate DOF": [
      { value: "f/4", label: "f/4" },
      { value: "f/5.6", label: "f/5.6 (balanced)" },
    ],
    "Deep DOF (Sharp BG)": [
      { value: "f/8", label: "f/8 (landscape)" },
      { value: "f/11", label: "f/11 (sharp)" },
      { value: "f/16", label: "f/16 (deep focus)" },
    ],
  },
  iso: {
    "Low (Clean)": [
      { value: "100", label: "100 (cleanest)" },
      { value: "200", label: "200" },
      { value: "400", label: "400" },
    ],
    "Medium": [
      { value: "800", label: "800" },
      { value: "1600", label: "1600" },
    ],
    "High (Grainy)": [
      { value: "3200", label: "3200 (noisy)" },
      { value: "6400", label: "6400 (grainy)" },
    ],
  },
};

const eyeDropperIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>`;
const editIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

let ui = null;
let currentNode = null;
let currentState = null;
let imageCanvas = null;
let canvasCtx = null;

async function openBuilder(node) {
  await loadData();
  if (!ui) ui = createOverlay();

  currentNode = node;
  currentState = applyPresetDefaults(cloneState(node.kikoState || defaultState()));

  renderForm(ui, currentState);
  ui.overlay.classList.add("show");
}

function closeBuilder() {
  currentNode = null;
  currentState = null;
  if (ui) ui.overlay.classList.remove("show");
}

function createOverlay() {
  ensureStyles();
  const overlay = createElement("div", "kiko-overlay");

  const node = createElement("div", "kiko-node");

  // Header
  const header = createElement("div", "kiko-node-header");
  const headerLeft = createElement("div", "kiko-node-header-left");
  const icon = createElement("div", "kiko-node-header-icon", "✨");
  const title = createElement("span", "", "FLUX 2 Prompt Builder");
  headerLeft.append(icon, title);
  const closeBtn = createElement("button", "kiko-close-btn", "×");
  closeBtn.onclick = closeBuilder;
  header.append(headerLeft, closeBtn);

  // Body
  const body = createElement("div", "kiko-node-body");

  // Footer
  const footer = createElement("div", "kiko-node-footer");
  const cancelBtn = createElement("button", "kiko-btn kiko-btn-secondary", "Cancel");
  cancelBtn.onclick = closeBuilder;
  const applyBtn = createElement("button", "kiko-btn kiko-btn-primary", "Apply");
  footer.append(cancelBtn, applyBtn);

  node.append(header, body, footer);
  overlay.appendChild(node);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeBuilder();
  });

  return { overlay, node, body, applyBtn };
}

function flattenOptionsToSelect(grouped, includeEmptyLabel = true) {
  const options = includeEmptyLabel ? [{ value: "", label: "— select —" }] : [];
  Object.entries(grouped || {}).forEach(([label, items]) => {
    if (!Array.isArray(items)) return;
    options.push({ value: "", label: `── ${label} ──`, disabled: true });
    items.forEach((item) => {
      options.push({ value: item.prompt || "", label: item.name || item.prompt || "" });
    });
  });
  return options;
}

function buildSelect(options, current) {
  const select = document.createElement("select");
  select.className = "kiko-field-input";
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.disabled) option.disabled = true;
    if (opt.value === current) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

function createComboInput(id, placeholder, options, value, onChange) {
  const wrapper = createElement("div", "kiko-combo-input");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "kiko-field-input";
  input.placeholder = placeholder;
  input.value = value || "";
  input.oninput = () => onChange(input.value);

  const toggleBtn = createElement("button", "kiko-dropdown-toggle", "▼");

  const menu = createElement("div", "kiko-dropdown-menu");
  menu.id = `kiko-menu-${id}`;

  Object.entries(options).forEach(([group, items]) => {
    const header = createElement("div", "kiko-option-header", group);
    menu.appendChild(header);
    items.forEach((item) => {
      const opt = createElement("div", "kiko-option", item.label);
      opt.dataset.value = item.value;
      opt.onclick = () => {
        input.value = item.value;
        menu.classList.remove("open");
        onChange(item.value);
      };
      menu.appendChild(opt);
    });
  });

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll(".kiko-dropdown-menu.open").forEach((m) => {
      if (m !== menu) m.classList.remove("open");
    });
    menu.classList.toggle("open");
  };

  wrapper.append(input, toggleBtn, menu);
  return wrapper;
}

function createStyleSelector(dropdown, textInput, currentValue, onChange) {
  const wrapper = createElement("div", "kiko-style-selector");

  dropdown.className = "kiko-field-input kiko-style-dropdown";
  dropdown.onchange = () => {
    textInput.value = dropdown.value;
    onChange(dropdown.value);
  };

  textInput.type = "text";
  textInput.className = "kiko-field-input kiko-style-text";
  textInput.value = currentValue || "";
  textInput.oninput = () => {
    onChange(textInput.value);
  };

  const editBtn = createElement("button", "kiko-edit-toggle");
  editBtn.innerHTML = editIcon;
  editBtn.title = "Edit raw text";
  editBtn.onclick = () => {
    wrapper.classList.toggle("edit-mode");
    if (wrapper.classList.contains("edit-mode")) {
      textInput.focus();
    }
  };

  wrapper.append(dropdown, textInput, editBtn);
  return wrapper;
}

function highlightJSON(json) {
  const str = JSON.stringify(json, null, 2);
  return str
    .replace(/"([^"]+)":/g, '<span class="kiko-json-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="kiko-json-string">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="kiko-json-number">$1</span>');
}

function updatePreview(previewEl, state) {
  const data = buildData(state);
  previewEl.innerHTML = highlightJSON(data);
}

function renderColors(container, state, onChange) {
  container.innerHTML = "";
  const colors = coercePalette(state.colors);
  const eyeDropperSupported = "EyeDropper" in window && window.isSecureContext;

  colors.forEach((color, idx) => {
    const chip = createElement("div", "kiko-color-chip");
    const isHex = color.startsWith("#");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = isHex ? color : "#888888";
    colorInput.title = "Pick a color";
    colorInput.oninput = (e) => {
      colors[idx] = e.target.value;
      textInput.value = e.target.value;
      state.colors = [...colors];
      onChange();
    };

    const eyeBtn = createElement("button", "kiko-eyedropper-btn");
    eyeBtn.innerHTML = eyeDropperIcon;
    eyeBtn.title = eyeDropperSupported ? "Pick color from screen" : "Eye dropper requires HTTPS";
    eyeBtn.disabled = !eyeDropperSupported;
    eyeBtn.onclick = async () => {
      if (!eyeDropperSupported) return;
      try {
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        colors[idx] = result.sRGBHex;
        state.colors = [...colors];
        renderColors(container, state, onChange);
        onChange();
      } catch (err) {
        console.log("EyeDropper cancelled:", err);
      }
    };

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = color;
    textInput.placeholder = "Color name or hex";
    textInput.oninput = (e) => {
      colors[idx] = e.target.value;
      if (e.target.value.match(/^#[0-9a-fA-F]{6}$/)) {
        colorInput.value = e.target.value;
      }
      state.colors = [...colors];
      onChange();
    };

    const removeBtn = createElement("button", "kiko-remove-color-btn", "×");
    removeBtn.onclick = () => {
      colors.splice(idx, 1);
      state.colors = [...colors];
      renderColors(container, state, onChange);
      onChange();
    };

    chip.append(colorInput, eyeBtn, textInput, removeBtn);
    container.appendChild(chip);
  });

  const addBtn = createElement("button", "kiko-add-color-btn", "+ Add Color");
  addBtn.onclick = () => {
    colors.push("");
    state.colors = [...colors];
    renderColors(container, state, onChange);
    onChange();
  };
  container.appendChild(addBtn);
}

function renderForm(uiParts, state) {
  const { body, applyBtn } = uiParts;
  body.innerHTML = "";

  const fieldGroup = (label, ...children) => {
    const group = createElement("div", "kiko-field-group");
    const lbl = createElement("div", "kiko-field-label", label);
    group.appendChild(lbl);
    children.forEach((c) => group.appendChild(c));
    return group;
  };

  const previewEl = createElement("pre", "kiko-json-preview");
  const update = () => updatePreview(previewEl, state);

  // Preset section
  const presetSection = createElement("div", "kiko-preset-section");
  const presetOptions = [{ value: "custom", label: "— Select a preset —" }];
  Object.keys(dataCache.presets || {}).forEach((key) => {
    presetOptions.push({ value: key, label: dataCache.presets[key].name || key });
  });
  const presetSelect = buildSelect(presetOptions, state.preset);
  presetSelect.onchange = () => {
    state.preset = presetSelect.value || "custom";
    if (state.preset !== "custom") {
      const merged = applyPresetDefaults({ ...defaultState(), preset: state.preset });
      Object.assign(state, merged);
    }
    renderForm(uiParts, state);
  };
  presetSection.appendChild(fieldGroup("Load Preset", presetSelect));
  body.appendChild(presetSection);

  // Main Prompt
  const promptInput = document.createElement("textarea");
  promptInput.className = "kiko-field-input";
  promptInput.placeholder = "Describe your scene in detail...";
  promptInput.value = state.prompt;
  promptInput.oninput = () => {
    state.prompt = promptInput.value;
    update();
  };
  body.appendChild(fieldGroup("Main Prompt", promptInput));

  // Style
  const styleOptions = flattenOptionsToSelect(dataCache.styles, true);
  const styleDropdown = buildSelect(styleOptions, state.style);
  const styleText = document.createElement("input");
  styleText.value = state.style;
  styleText.placeholder = "e.g., photorealistic, cinematic lighting";
  const styleSelector = createStyleSelector(styleDropdown, styleText, state.style, (v) => {
    state.style = v;
    update();
  });
  body.appendChild(fieldGroup("Style", styleSelector));

  // Camera Settings sub-section
  const cameraSection = createElement("div", "kiko-sub-section");
  const cameraTitle = createElement("div", "kiko-sub-section-title", "Camera Settings");
  cameraSection.appendChild(cameraTitle);

  const row1 = createElement("div", "kiko-inline-fields");
  const angleGroup = createElement("div", "kiko-field-group");
  angleGroup.appendChild(createElement("div", "kiko-field-label", "Angle"));
  angleGroup.appendChild(
    createComboInput("angle", "eye level", cameraOptions.angle, state.cameraAngle, (v) => {
      state.cameraAngle = v;
      update();
    })
  );
  const shotGroup = createElement("div", "kiko-field-group");
  shotGroup.appendChild(createElement("div", "kiko-field-label", "Shot / Distance"));
  shotGroup.appendChild(
    createComboInput("shot", "medium shot", cameraOptions.shot, state.cameraShot, (v) => {
      state.cameraShot = v;
      update();
    })
  );
  row1.append(angleGroup, shotGroup);
  cameraSection.appendChild(row1);

  const row2 = createElement("div", "kiko-inline-fields");
  const lensGroup = createElement("div", "kiko-field-group");
  lensGroup.appendChild(createElement("div", "kiko-field-label", "Lens (mm)"));
  lensGroup.appendChild(
    createComboInput("lens", "50mm", cameraOptions.lens, state.cameraLens, (v) => {
      state.cameraLens = v;
      update();
    })
  );
  const apertureGroup = createElement("div", "kiko-field-group");
  apertureGroup.appendChild(createElement("div", "kiko-field-label", "Aperture"));
  apertureGroup.appendChild(
    createComboInput("aperture", "f/2.8", cameraOptions.aperture, state.cameraAperture, (v) => {
      state.cameraAperture = v;
      update();
    })
  );
  row2.append(lensGroup, apertureGroup);
  cameraSection.appendChild(row2);

  const row3 = createElement("div", "kiko-inline-fields");
  const isoGroup = createElement("div", "kiko-field-group");
  isoGroup.appendChild(createElement("div", "kiko-field-label", "ISO"));
  isoGroup.appendChild(
    createComboInput("iso", "100", cameraOptions.iso, state.cameraISO, (v) => {
      state.cameraISO = v;
      update();
    })
  );
  const focusGroup = createElement("div", "kiko-field-group");
  focusGroup.appendChild(createElement("div", "kiko-field-label", "Focus Description"));
  const focusInput = document.createElement("input");
  focusInput.type = "text";
  focusInput.className = "kiko-field-input";
  focusInput.placeholder = "Sharp focus on subject";
  focusInput.value = state.cameraFocus;
  focusInput.oninput = () => {
    state.cameraFocus = focusInput.value;
    update();
  };
  focusGroup.appendChild(focusInput);
  row3.append(isoGroup, focusGroup);
  cameraSection.appendChild(row3);

  // Camera / Film Stock
  const cameraModelGroup = createElement("div", "kiko-field-group");
  const cameraModelLabel = createElement("div", "kiko-field-label");
  cameraModelLabel.innerHTML = 'Camera / Film Stock <span class="kiko-hint">(optional)</span>';
  cameraModelGroup.appendChild(cameraModelLabel);
  const cameraOptions2 = flattenOptionsToSelect(dataCache.cameras, true);
  const cameraDropdown = buildSelect(cameraOptions2, state.cameraModel);
  const cameraText = document.createElement("input");
  cameraText.value = state.cameraModel;
  cameraText.placeholder = "e.g., Shot on Sony A7 IV, Kodak Portra 400";
  const cameraSelector = createStyleSelector(cameraDropdown, cameraText, state.cameraModel, (v) => {
    state.cameraModel = v;
    update();
  });
  cameraModelGroup.appendChild(cameraSelector);
  cameraSection.appendChild(cameraModelGroup);

  body.appendChild(cameraSection);

  // Lighting sub-section
  const lightingSection = createElement("div", "kiko-sub-section");
  lightingSection.appendChild(createElement("div", "kiko-sub-section-title", "Lighting"));
  const lightingOptions = flattenOptionsToSelect(dataCache.lighting, true);
  const lightingDropdown = buildSelect(lightingOptions, state.lighting);
  const lightingText = document.createElement("input");
  lightingText.value = state.lighting;
  lightingText.placeholder = "e.g., Golden hour, three-point lighting";
  const lightingSelector = createStyleSelector(lightingDropdown, lightingText, state.lighting, (v) => {
    state.lighting = v;
    update();
  });
  lightingSection.appendChild(fieldGroup("", lightingSelector));
  body.appendChild(lightingSection);

  // Color Palette sub-section
  const colorSection = createElement("div", "kiko-sub-section");
  colorSection.appendChild(createElement("div", "kiko-sub-section-title", "Color Palette"));

  // Image picker
  const imageDropZone = createElement("div", "kiko-image-drop-zone");
  const dropContent = createElement("div", "kiko-drop-zone-content");
  dropContent.innerHTML = `
    <div class="kiko-drop-icon">🖼️</div>
    <div class="kiko-drop-text">Drop image here or click to upload</div>
    <div class="kiko-drop-hint">Click on image to pick colors</div>
  `;
  imageCanvas = document.createElement("canvas");
  imageCanvas.className = "kiko-image-canvas";
  const clearImageBtn = createElement("button", "kiko-clear-image-btn", "×");
  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.accept = "image/*";
  imageInput.style.display = "none";

  const pickedColorPreview = createElement("div", "kiko-picked-color-preview");
  const previewSwatch = createElement("div", "kiko-preview-swatch");
  const previewHex = createElement("span", "", "Click image to add color");
  pickedColorPreview.append(previewSwatch, previewHex);

  imageDropZone.append(dropContent, imageCanvas, clearImageBtn);
  colorSection.append(imageDropZone, imageInput, pickedColorPreview);

  // Setup image picker events
  canvasCtx = imageCanvas.getContext("2d", { willReadFrequently: true });

  imageDropZone.onclick = (e) => {
    if (e.target === imageCanvas || e.target === clearImageBtn) return;
    if (!imageDropZone.classList.contains("has-image")) {
      imageInput.click();
    }
  };

  imageInput.onchange = (e) => {
    if (e.target.files?.[0]) loadImageToCanvas(e.target.files[0], imageDropZone, imageCanvas, canvasCtx, pickedColorPreview);
  };

  imageDropZone.ondragover = (e) => {
    e.preventDefault();
    imageDropZone.classList.add("drag-over");
  };
  imageDropZone.ondragleave = (e) => {
    e.preventDefault();
    imageDropZone.classList.remove("drag-over");
  };
  imageDropZone.ondrop = (e) => {
    e.preventDefault();
    imageDropZone.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files?.[0]?.type.startsWith("image/")) {
      loadImageToCanvas(files[0], imageDropZone, imageCanvas, canvasCtx, pickedColorPreview);
    }
  };

  clearImageBtn.onclick = (e) => {
    e.stopPropagation();
    canvasCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCanvas.width = 0;
    imageCanvas.height = 0;
    imageInput.value = "";
    imageDropZone.classList.remove("has-image");
    pickedColorPreview.classList.remove("visible");
  };

  imageCanvas.onmousemove = (e) => {
    if (!imageDropZone.classList.contains("has-image")) return;
    const hex = getCanvasColorAt(e, imageCanvas, canvasCtx);
    previewSwatch.style.backgroundColor = hex;
    previewHex.textContent = hex;
  };

  imageCanvas.onclick = (e) => {
    if (!imageDropZone.classList.contains("has-image")) return;
    const hex = getCanvasColorAt(e, imageCanvas, canvasCtx);
    state.colors = coercePalette(state.colors);
    state.colors.push(hex);
    renderColors(paletteContainer, state, update);
    update();
    pickedColorPreview.style.borderColor = "#7c3aed";
    setTimeout(() => {
      pickedColorPreview.style.borderColor = "#3a3a3a";
    }, 200);
  };

  // Color palette chips
  const paletteContainer = createElement("div", "kiko-color-palette");
  renderColors(paletteContainer, state, update);
  colorSection.appendChild(paletteContainer);

  // Color Mood
  const moodOptions = flattenOptionsToSelect(dataCache.mood, true);
  const moodDropdown = buildSelect(moodOptions, state.colorMood);
  const moodText = document.createElement("input");
  moodText.value = state.colorMood;
  moodText.placeholder = "e.g., moody yet vibrant";
  const moodSelector = createStyleSelector(moodDropdown, moodText, state.colorMood, (v) => {
    state.colorMood = v;
    update();
  });
  colorSection.appendChild(fieldGroup("Mood", moodSelector));

  body.appendChild(colorSection);

  // Composition sub-section
  const compositionSection = createElement("div", "kiko-sub-section");
  compositionSection.appendChild(createElement("div", "kiko-sub-section-title", "Composition"));
  const compositionOptions = flattenOptionsToSelect(dataCache.composition, true);
  const compositionDropdown = buildSelect(compositionOptions, state.composition);
  const compositionText = document.createElement("input");
  compositionText.value = state.composition;
  compositionText.placeholder = "rule of thirds, leading lines";
  const compositionSelector = createStyleSelector(compositionDropdown, compositionText, state.composition, (v) => {
    state.composition = v;
    update();
  });
  compositionSection.appendChild(compositionSelector);
  body.appendChild(compositionSection);

  // Output Options sub-section
  const outputSection = createElement("div", "kiko-sub-section");
  outputSection.appendChild(createElement("div", "kiko-sub-section-title", "Output Options"));

  const toggleRow1 = createElement("div", "kiko-toggle-row");
  const toggleLabel1 = createElement("span", "kiko-toggle-label", "Include empty fields");
  const toggleSwitch1 = createElement("label", "kiko-toggle-switch");
  const toggleInput1 = document.createElement("input");
  toggleInput1.type = "checkbox";
  toggleInput1.checked = state.includeEmpty;
  toggleInput1.onchange = () => {
    state.includeEmpty = toggleInput1.checked;
    update();
  };
  const toggleSlider1 = createElement("span", "kiko-toggle-slider");
  toggleSwitch1.append(toggleInput1, toggleSlider1);
  toggleRow1.append(toggleLabel1, toggleSwitch1);
  outputSection.appendChild(toggleRow1);

  const toggleRow2 = createElement("div", "kiko-toggle-row");
  const toggleLabel2 = createElement("span", "kiko-toggle-label", "Numeric lens-mm format");
  const toggleSwitch2 = createElement("label", "kiko-toggle-switch");
  const toggleInput2 = document.createElement("input");
  toggleInput2.type = "checkbox";
  toggleInput2.checked = state.numericLens;
  toggleInput2.onchange = () => {
    state.numericLens = toggleInput2.checked;
    update();
  };
  const toggleSlider2 = createElement("span", "kiko-toggle-slider");
  toggleSwitch2.append(toggleInput2, toggleSlider2);
  toggleRow2.append(toggleLabel2, toggleSwitch2);
  outputSection.appendChild(toggleRow2);

  body.appendChild(outputSection);

  // JSON Preview
  body.appendChild(previewEl);
  update();

  // Apply button
  applyBtn.onclick = () => {
    if (!currentNode) return;
    currentNode.kikoState = cloneState(state);
    syncWidgets(currentNode, currentNode.kikoState);
    if (currentNode.graph?.setDirtyCanvas) currentNode.graph.setDirtyCanvas(true, true);
    closeBuilder();
  };

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".kiko-combo-input")) {
      document.querySelectorAll(".kiko-dropdown-menu.open").forEach((m) => m.classList.remove("open"));
    }
  });
}

function loadImageToCanvas(file, dropZone, canvas, ctx, preview) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = dropZone.clientWidth - 4;
      const maxHeight = 200;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      dropZone.classList.add("has-image");
      preview.classList.add("visible");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function getCanvasColorAt(e, canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return (
    "#" +
    pixel[0].toString(16).padStart(2, "0") +
    pixel[1].toString(16).padStart(2, "0") +
    pixel[2].toString(16).padStart(2, "0")
  ).toUpperCase();
}

app.registerExtension({
  name: EXTENSION_ID,
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name === NODE_NAME) {
      attachBuilder(nodeType);
    }
  },
});
