"""Kiko FLUX2 Prompt Builder - ComfyUI custom node."""

from .nodes.prompt_builder_node import KikoFlux2PromptBuilder

NODE_CLASS_MAPPINGS = {"KikoFlux2PromptBuilder": KikoFlux2PromptBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"KikoFlux2PromptBuilder": "Kiko FLUX2 Prompt Builder"}

# Expose the web assets for the frontend extension.
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
