"""frontend/event_console.py — Event log panel and helpers."""

from __future__ import annotations

from typing import Any

from nicegui import ui

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
    """Append a line to every connected client's event log."""
    from frontend.app import client_refs

    for refs in list(client_refs.values()):
        if "log" not in refs:
            continue
        log_widget = refs["log"]
        if log_widget.is_deleted:
            continue
        try:
            client = log_widget.client
        except RuntimeError:
            continue
        if getattr(client, "_deleted", False):
            continue
        try:
            log_widget.push(msg)
        except RuntimeError:
            continue


def build_event_console(refs: dict[str, Any]) -> None:
    """Create the EVENT LOG card and assign the log widget to ``refs['log']``."""
    with ui.card().classes("sb-card").style(
        "width:100%; max-width:1140px; margin-top:10px; padding:14px 16px"
    ):
        ui.label("EVENT LOG").classes("sb-label-xs").style("margin-bottom:6px")
        refs["log"] = ui.log(max_lines=100).style("height:80px; width:100%")
