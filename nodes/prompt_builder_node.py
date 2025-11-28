"""ComfyUI node for the Kiko FLUX2 Prompt Builder."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Tuple

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PACKAGE_ROOT / "web" / "data"


def _load_json(name: str) -> Any:
    """Load JSON data from the web/data directory."""
    path = DATA_DIR / name
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


PRESETS: Dict[str, Any] = _load_json("presets.json")
STYLE_GROUPS: Dict[str, Any] = _load_json("styles.json")
CAMERA_GROUPS: Dict[str, Any] = _load_json("cameras.json")
LIGHTING_GROUPS: Dict[str, Any] = _load_json("lighting.json")
MOOD_GROUPS: Dict[str, Any] = _load_json("mood.json")
COMPOSITION_GROUPS: Dict[str, Any] = _load_json("composition.json")

PRESET_NAMES = ["custom"] + sorted(PRESETS.keys())
STYLE_CHOICES = [""] + [
    preset.get("prompt", "")
    for values in STYLE_GROUPS.values()
    for preset in values
    if isinstance(preset, dict)
]
CAMERA_CHOICES = [""] + [
    preset.get("prompt", "")
    for values in CAMERA_GROUPS.values()
    for preset in values
    if isinstance(preset, dict)
]
LIGHTING_CHOICES = [""] + [
    preset.get("prompt", "")
    for values in LIGHTING_GROUPS.values()
    for preset in values
    if isinstance(preset, dict)
]
MOOD_CHOICES = [""] + [
    preset.get("prompt", "")
    for values in MOOD_GROUPS.values()
    for preset in values
    if isinstance(preset, dict)
]
COMPOSITION_CHOICES = [""] + [
    preset.get("prompt", "")
    for values in COMPOSITION_GROUPS.values()
    for preset in values
    if isinstance(preset, dict)
]


def _default_state() -> Dict[str, Any]:
    return {
        "preset": "custom",
        "prompt": "",
        "style": "",
        "cameraAngle": "",
        "cameraShot": "",
        "cameraLens": "",
        "cameraAperture": "",
        "cameraISO": "",
        "cameraFocus": "",
        "cameraModel": "",
        "lighting": "",
        "colors": ["#2A5BDA", "amber glow"],
        "colorMood": "",
        "composition": "",
        "includeEmpty": False,
        "numericLens": True,
    }


def _parse_builder_payload(payload: str) -> Dict[str, Any]:
    """Best-effort payload parsing."""
    if not isinstance(payload, str) or not payload.strip():
        return {}
    try:
        parsed = json.loads(payload)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _apply_preset_defaults(state: Dict[str, Any]) -> Dict[str, Any]:
    """Apply preset defaults to empty fields when a preset is selected."""
    preset_name = state.get("preset")
    if not preset_name or preset_name == "custom":
        return state

    preset_data = PRESETS.get(preset_name)
    if not preset_data:
        return state

    updated = deepcopy(state)
    updated["prompt"] = updated["prompt"] or preset_data.get("prompt", "")
    updated["style"] = updated["style"] or preset_data.get("style", "")

    camera = preset_data.get("camera", {})
    updated["cameraAngle"] = updated["cameraAngle"] or camera.get("angle", "")
    updated["cameraShot"] = updated["cameraShot"] or camera.get("shot", "")
    updated["cameraLens"] = updated["cameraLens"] or camera.get("lens", "")
    updated["cameraAperture"] = updated["cameraAperture"] or camera.get("aperture", "")
    updated["cameraISO"] = updated["cameraISO"] or camera.get("iso", "")
    updated["cameraFocus"] = updated["cameraFocus"] or camera.get("focus", "")
    updated["cameraModel"] = updated["cameraModel"] or camera.get("model", "")

    updated["lighting"] = updated["lighting"] or preset_data.get("lighting", "")

    colors = preset_data.get("colors", {})
    if (not updated.get("colors") or updated["colors"] == ["#2A5BDA", "amber glow"]) and colors.get(
        "palette"
    ):
        updated["colors"] = list(colors.get("palette", []))
    updated["colorMood"] = updated["colorMood"] or colors.get("mood", "")

    updated["composition"] = updated["composition"] or preset_data.get("composition", "")
    return updated


def _coerce_palette(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


def _build_data(state: Dict[str, Any]) -> Dict[str, Any]:
    include_empty = bool(state.get("includeEmpty"))
    numeric_lens = bool(state.get("numericLens"))

    prompt = state.get("prompt", "")
    style = state.get("style", "")
    camera_angle = state.get("cameraAngle", "")
    camera_shot = state.get("cameraShot", "")
    camera_lens = state.get("cameraLens", "")
    camera_aperture = state.get("cameraAperture", "")
    camera_iso = state.get("cameraISO", "")
    camera_focus = state.get("cameraFocus", "")
    camera_model = state.get("cameraModel", "")
    lighting = state.get("lighting", "")
    palette = _coerce_palette(state.get("colors", []))
    color_mood = state.get("colorMood", "")
    composition = state.get("composition", "")

    data: Dict[str, Any] = {}

    if prompt or include_empty:
        data["prompt"] = prompt
    if style or include_empty:
        data["style"] = style

    camera: Dict[str, Any] = {}
    if camera_angle or include_empty:
        camera["angle"] = camera_angle
    if camera_shot or include_empty:
        camera["distance"] = camera_shot

    if camera_lens or include_empty:
        if numeric_lens:
            digits = "".join(ch for ch in str(camera_lens) if ch.isdigit())
            if digits:
                camera["lens-mm"] = int(digits)
            else:
                camera["lens"] = camera_lens
        else:
            camera["lens"] = camera_lens

    if camera_aperture or include_empty:
        camera["f-number"] = camera_aperture
    if camera_iso or include_empty:
        try:
            camera["ISO"] = int(camera_iso)
        except (TypeError, ValueError):
            camera["ISO"] = camera_iso
    if camera_focus or include_empty:
        camera["focus"] = camera_focus

    if camera or include_empty:
        data["camera"] = camera

    if camera_model:
        data["film_stock"] = camera_model

    if lighting or include_empty:
        data["lighting"] = lighting

    if palette or color_mood or include_empty:
        colors: Dict[str, Any] = {}
        if palette or include_empty:
            colors["palette"] = palette
        if color_mood or include_empty:
            colors["mood"] = color_mood
        data["colors"] = colors

    if composition or include_empty:
        data["composition"] = composition

    return data


def _build_text_prompt(data: Dict[str, Any]) -> str:
    parts: List[str] = []
    if data.get("prompt"):
        parts.append(str(data["prompt"]))
    if data.get("style"):
        parts.append(f"Style: {data['style']}")

    camera = data.get("camera") or {}
    if camera:
        camera_desc: List[str] = []
        if camera.get("angle"):
            camera_desc.append(f"{camera['angle']} angle")
        if camera.get("distance"):
            camera_desc.append(camera["distance"])
        if camera.get("lens-mm") is not None:
            camera_desc.append(f"{camera['lens-mm']}mm lens")
        elif camera.get("lens"):
            camera_desc.append(f"{camera['lens']} lens")
        if camera.get("f-number"):
            camera_desc.append(camera["f-number"])
        if camera_desc:
            parts.append(f"Camera: {', '.join(camera_desc)}")
        if camera.get("focus"):
            parts.append(f"Focus: {camera['focus']}")
        if data.get("film_stock"):
            parts.append(str(data["film_stock"]))

    if data.get("lighting"):
        parts.append(f"Lighting: {data['lighting']}")

    colors = data.get("colors") or {}
    palette = colors.get("palette") or []
    if palette:
        parts.append(f"Colors: {', '.join(palette)}")
    if colors.get("mood"):
        parts.append(f"Mood: {colors['mood']}")

    if data.get("composition"):
        parts.append(f"Composition: {data['composition']}")

    return ". ".join(parts)


class KikoFlux2PromptBuilder:
    """
    Build structured JSON prompts for image generation models.

    Compatible with FLUX (Black Forest Labs - https://bfl.ai/),
    z-image (https://z-image.ai/), and any other model that accepts
    structured JSON prompts. Features photography-style controls:
    presets, camera settings, lighting, colors, composition, and toggles.
    """

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("json_prompt", "text_prompt", "prompt_only")
    FUNCTION = "build_prompt"
    CATEGORY = "🫶 ComfyAssets/🧠 Prompts"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "placeholder": "Describe your scene in detail...",
                        "tooltip": "Main scene description",
                    },
                ),
            },
            "optional": {
                "preset": (
                    PRESET_NAMES,
                    {
                        "default": "custom",
                        "tooltip": "Load preset values; custom keeps your manual fields",
                    },
                ),
                "style": ("STRING", {"default": "", "placeholder": "Visual style or reference"}),
                "camera_angle": (
                    "STRING",
                    {"default": "", "placeholder": "e.g., eye level, low angle"},
                ),
                "camera_shot": ("STRING", {"default": "", "placeholder": "e.g., medium close-up"}),
                "camera_lens": ("STRING", {"default": "", "placeholder": "e.g., 35mm, 85mm"}),
                "camera_aperture": ("STRING", {"default": "", "placeholder": "e.g., f/1.4"}),
                "camera_iso": ("STRING", {"default": "", "placeholder": "e.g., 200"}),
                "camera_focus": (
                    "STRING",
                    {"default": "", "placeholder": "e.g., Sharp focus on eyes"},
                ),
                "camera_model": ("STRING", {"default": "", "placeholder": "Film stock or body"}),
                "lighting": (
                    "STRING",
                    {"default": "", "placeholder": "e.g., golden hour, softbox"},
                ),
                "color_palette": (
                    "STRING",
                    {
                        "default": "",
                        "placeholder": "Comma-separated hex or descriptive colors",
                    },
                ),
                "color_mood": ("STRING", {"default": "", "placeholder": "e.g., moody atmosphere"}),
                "composition": (
                    "STRING",
                    {
                        "default": "",
                        "placeholder": "Composition (choose from dropdown in UI or type your own)",
                    },
                ),
                "include_empty_fields": ("BOOLEAN", {"default": False}),
                "numeric_lens_format": ("BOOLEAN", {"default": True}),
                # Frontend builder payload is injected automatically; kept optional for interoperability.
                "builder_payload": (
                    "STRING",
                    {"multiline": True, "default": "", "placeholder": "Managed by UI"},
                ),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    def build_prompt(
        self,
        prompt: str,
        preset: str = "custom",
        style: str = "",
        camera_angle: str = "",
        camera_shot: str = "",
        camera_lens: str = "",
        camera_aperture: str = "",
        camera_iso: str = "",
        camera_focus: str = "",
        camera_model: str = "",
        lighting: str = "",
        color_palette: str = "",
        color_mood: str = "",
        composition: str = "",
        include_empty_fields: bool = False,
        numeric_lens_format: bool = True,
        builder_payload: str = "",
        **_: Any,
    ) -> Tuple[str, str, str]:
        # Start with defaults then overlay payload and explicit inputs.
        state = _default_state()
        payload = _parse_builder_payload(builder_payload)
        state.update(payload)

        # Explicit inputs take priority over payload.
        state["preset"] = preset or state.get("preset", "custom")
        state["prompt"] = prompt if prompt is not None else state.get("prompt", "")
        state["style"] = style if style is not None else state.get("style", "")
        state["cameraAngle"] = (
            camera_angle if camera_angle is not None else state.get("cameraAngle", "")
        )
        state["cameraShot"] = (
            camera_shot if camera_shot is not None else state.get("cameraShot", "")
        )
        state["cameraLens"] = (
            camera_lens if camera_lens is not None else state.get("cameraLens", "")
        )
        state["cameraAperture"] = (
            camera_aperture if camera_aperture is not None else state.get("cameraAperture", "")
        )
        state["cameraISO"] = camera_iso if camera_iso is not None else state.get("cameraISO", "")
        state["cameraFocus"] = (
            camera_focus if camera_focus is not None else state.get("cameraFocus", "")
        )
        state["cameraModel"] = (
            camera_model if camera_model is not None else state.get("cameraModel", "")
        )
        state["lighting"] = lighting if lighting is not None else state.get("lighting", "")
        state["colorMood"] = color_mood if color_mood is not None else state.get("colorMood", "")
        state["composition"] = (
            composition if composition is not None else state.get("composition", "")
        )

        # Palette (string or list)
        if color_palette:
            state["colors"] = _coerce_palette(color_palette)
        elif "colors" not in state:
            state["colors"] = _default_state()["colors"]

        # Toggles
        state["includeEmpty"] = (
            include_empty_fields
            if include_empty_fields is not None
            else state.get("includeEmpty", False)
        )
        state["numericLens"] = (
            numeric_lens_format
            if numeric_lens_format is not None
            else state.get("numericLens", True)
        )

        # Apply preset defaults to any remaining gaps.
        state = _apply_preset_defaults(state)

        # Build outputs
        data = _build_data(state)
        json_prompt = json.dumps(data, indent=2)
        text_prompt = _build_text_prompt(data)
        prompt_only = state.get("prompt", "")

        return (json_prompt, text_prompt, prompt_only)

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")
