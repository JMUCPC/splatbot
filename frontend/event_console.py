"""frontend/event_console.py — Event log panel and helpers."""

from __future__ import annotations

from typing import Any

from nicegui import ui

# Populated by build_event_console(); same dict as app._r
_refs: dict[str, Any] | None = None

# Injected into app.HEAD_HTML (inside the main <style> block)
NICEGUI_LOG_CSS = """
  /* ── NiceGUI log skin ── */
  .nicegui-log {
    background: #070d1a !important;
    color: #3a5070 !important;
    font-family: 'Share Tech Mono', monospace !important;
    font-size: 0.7rem !important;
    border-radius: 4px !important;
  }
"""


def log_event(msg: str) -> None:
    """Append a line to the event log if the UI has been built."""
    if _refs is not None and "log" in _refs:
        _refs["log"].push(msg)


def build_event_console(refs: dict[str, Any]) -> None:
    """Create the EVENT LOG card and assign the log widget to ``refs['log']``."""
    global _refs
    _refs = refs

    with ui.card().classes("sb-card").style(
        "width:100%; max-width:1140px; margin-top:10px; padding:14px 16px"
    ):
        ui.label("EVENT LOG").classes("sb-label-xs").style("margin-bottom:6px")
        refs["log"] = ui.log(max_lines=100).style("height:80px; width:100%")
