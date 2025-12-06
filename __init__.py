"""Kiko FLUX2 Prompt Builder - ComfyUI custom node."""

import json
from pathlib import Path

from aiohttp import web
from server import PromptServer

from .nodes.prompt_builder_node import KikoFlux2PromptBuilder

NODE_CLASS_MAPPINGS = {"KikoFlux2PromptBuilder": KikoFlux2PromptBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"KikoFlux2PromptBuilder": "Kiko FLUX2 Prompt Builder"}

# Expose the web assets for the frontend extension.
WEB_DIRECTORY = "./web"

# API endpoint to serve preset data (more reliable than static file serving)
DATA_DIR = Path(__file__).resolve().parent / "web" / "data"


@PromptServer.instance.routes.get("/kiko-flux2-prompt-builder/data/{filename}")
async def get_preset_data(request: web.Request) -> web.Response:
    """Serve preset JSON data via API endpoint."""
    filename = request.match_info.get("filename", "")

    # Security: only allow specific JSON files
    allowed_files = {"presets.json", "styles.json", "cameras.json",
                     "lighting.json", "mood.json", "composition.json"}

    if filename not in allowed_files:
        return web.Response(status=404, text="Not found")

    filepath = DATA_DIR / filename
    if not filepath.exists():
        return web.Response(status=404, text="File not found")

    try:
        with filepath.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return web.json_response(data)
    except (json.JSONDecodeError, IOError) as e:
        return web.Response(status=500, text=f"Error loading data: {e}")


__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
