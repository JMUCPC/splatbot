"""frontend/app.py — NiceGUI frontend for Splatbot.

Run via main.py (project root).  In demo mode the engine is driven by a
built-in random-walk simulator so the UI can be tested without any bot files.
"""

from __future__ import annotations

import time
from typing import Any

from nicegui import Client, context, ui

from engine.game_state import GameState, GameStateSingleton
from engine.turn_runner import (
    BotRunner,
    get_bot_timing_stats,
    reset_bot_timing_stats,
    run_turn_async,
)
from frontend.hex_renderer import render_hex_grid
from frontend.event_console import NICEGUI_LOG_CSS, build_event_console, log_event
import config

# ── Module-level runtime (match state lives in GameStateSingleton) ───────────

_running: bool = False
_tick_delay: float = config.TICK_DELAY
_last_tick: float = 0.0
_demo_mode: bool = True
_bot_labels: dict = {1: "demo (random walk)", 2: "demo (random walk)"}

# Per-browser-tab element refs: client_id -> widget dict
client_refs: dict[str, dict[str, Any]] = {}

_shared_head_installed: bool = False
_game_timer_started: bool = False
_runners: dict[int, BotRunner] = {}


# ── UI update ─────────────────────────────────────────────────────────────────


def _push_refs(refs: dict[str, Any], gs: GameState) -> None:
    sc = gs.score()
    pct = gs.turn / max(1, gs.max_turns)
    timing_stats = get_bot_timing_stats()

    if "hex" in refs:
        refs["hex"].content = render_hex_grid(gs, config.HEX_SIZE)
    if "score_1" in refs:
        refs["score_1"].set_text(str(sc[1]))
    if "score_2" in refs:
        refs["score_2"].set_text(str(sc[2]))
    if "pct_1" in refs:
        refs["pct_1"].set_text(f"{gs.coverage_pct()[1]:.1f}%")
    if "pct_2" in refs:
        refs["pct_2"].set_text(f"{gs.coverage_pct()[2]:.1f}%")
    if "decision_time_1" in refs:
        p1 = timing_stats.get(1, {})
        p1_count = int(p1.get("decision_count", 0))
        p1_avg = (float(p1.get("total_decision_seconds", 0.0)) / p1_count) if p1_count else 0.0
        refs["decision_time_1"].set_text(f"{p1_avg:.5f}s/dec")
    if "decision_time_2" in refs:
        p2 = timing_stats.get(2, {})
        p2_count = int(p2.get("decision_count", 0))
        p2_avg = (float(p2.get("total_decision_seconds", 0.0)) / p2_count) if p2_count else 0.0
        refs["decision_time_2"].set_text(f"{p2_avg:.5f}s/dec")
    if "turn_num" in refs:
        refs["turn_num"].set_text(str(gs.turn))
    if "progress" in refs:
        refs["progress"].value = pct

    if "status" in refs:
        if gs.is_over:
            w = gs.winner()
            if w == 1:
                text, col = "P1 WINS", config.PLAYER_BOT_COLORS[1]
            elif w == 2:
                text, col = "P2 WINS", config.PLAYER_BOT_COLORS[2]
            else:
                text, col = "DRAW", "#8899aa"
        elif _running:
            text, col = "● LIVE", "#22cc66"
        else:
            text, col = "● PAUSED", "#4a6080"
        refs["status"].set_text(text)
        refs["status"].style(
            f"color:{col}; font-family:'Share Tech Mono',monospace; "
            f"font-size:0.75rem; letter-spacing:0.2em"
        )


def _push() -> None:
    """Push current game state to every connected browser tab."""
    gs = GameStateSingleton().current
    for cid in list(client_refs.keys()):
        c = Client.instances.get(cid)
        if c is None or getattr(c, "_deleted", False):
            client_refs.pop(cid, None)
            continue
        refs = client_refs.get(cid)
        if not refs:
            continue
        with c:
            _push_refs(refs, gs)


# ── Control callbacks ─────────────────────────────────────────────────────────


def _start() -> None:
    global _running
    _running = True
    global _runners
    _runners = {
        pid: BotRunner(bot_data.bot)
        for pid, bot_data in GameStateSingleton().current.bots.items()
    }
    _push()
    log_event("Match started.")


def _pause() -> None:
    global _running
    _running = False
    _push()
    log_event("Paused.")


def _reset() -> None:
    global _runners
    for runner in _runners.values():
        runner.shutdown()
    _runners = {}
    reset_bot_timing_stats()
    global _running
    _running = False
    GameStateSingleton().reset(config.GRID_RADIUS, config.MAX_TURNS)
    _push()
    log_event("Match reset.")


def _set_speed(val: float) -> None:
    """Map slider 1–20 → delay 0.50s–0.03s (non-linear feel)."""
    global _tick_delay
    _tick_delay = round(max(0.03, 0.53 - float(val) * 0.025), 3)


# ── Timer tick ────────────────────────────────────────────────────────────────


async def _tick() -> None:
    global _running, _last_tick
    if not _running:
        return
    now = time.monotonic()
    if now - _last_tick < _tick_delay:
        return
    _last_tick = now

    state = GameStateSingleton().current
    if state.is_over:
        _running = False
        _push()
        sc = state.score()
        log_event(f"Match over — P1: {sc[1]} tiles  |  P2: {sc[2]} tiles")
        return

    state.advance_turn()
    await run_turn_async(_runners)
    _push()


# ── Page builder ──────────────────────────────────────────────────────────────

FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700"
    "&display=swap"
)

HEAD_HTML = f"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{FONTS}" rel="stylesheet">
<style>
  /* ── Base ── */
  body, .q-page {{ background-color: #080c14 !important; }}

  /* ── Typography helpers ── */
  .sb-mono    {{ font-family: 'Share Tech Mono', monospace !important; }}
  .sb-cond    {{ font-family: 'Barlow Condensed', sans-serif !important; }}

  /* ── Component skins ── */
  .sb-card {{
    background: #0e1525 !important;
    border: 1px solid #1a2a40 !important;
    border-radius: 8px !important;
    box-shadow: none !important;
  }}
  .sb-btn {{
    background: #111c2e !important;
    border: 1px solid #1e2d47 !important;
    color: #8899aa !important;
    font-family: 'Share Tech Mono', monospace !important;
    font-size: 0.82rem !important;
    min-height: 34px !important;
    padding: 0 14px !important;
    border-radius: 5px !important;
    transition: border-color 0.15s, color 0.15s !important;
  }}
  .sb-btn:hover {{
    border-color: #3a5070 !important;
    color: #c0d0e0 !important;
  }}
  .sb-label-xs {{
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.28em;
    color: #2e4060;
    text-transform: uppercase;
  }}
  .sb-score {{
    font-family: 'Share Tech Mono', monospace;
    font-size: 3.4rem;
    line-height: 1;
    font-weight: 400;
  }}
  .sb-divider {{ background-color: #1a2a40 !important; }}

  /* ── Hex container ── */
  .hex-wrap {{
    background: #070d1a;
    border-radius: 6px;
    overflow: hidden;
    display: block;
    width: 100%;
  }}
{NICEGUI_LOG_CSS}
  /* ── Quasar progress bar override ── */
  .sb-progress .q-linear-progress__track {{ background: #111c2e !important; }}
  .sb-progress .q-linear-progress__model {{ background: #ff6b2b !important; }}

  /* ── Path input ── */
  .sb-input .q-field__native {{
    font-family: 'Share Tech Mono', monospace !important;
    font-size: 0.7rem !important;
    color: #607080 !important;
  }}
  .sb-input .q-field__control {{ background: #070d1a !important; border-radius: 4px; }}

  /* ── Slider accent ── */
  .sb-slider .q-slider__track-container .q-slider__track {{ background: #ff6b2b !important; }}
  .sb-slider .q-slider__thumb {{ background: #ff6b2b !important; }}
</style>
"""


def _ensure_shared_assets() -> None:
    """Dark mode, shared head HTML, and single game timer — once per process."""
    global _shared_head_installed, _game_timer_started
    if not _shared_head_installed:
        ui.dark_mode().enable()
        ui.add_head_html(HEAD_HTML, shared=True)
        _shared_head_installed = True
    if not _game_timer_started:
        ui.timer(0.05, _tick)
        _game_timer_started = True


@ui.page("/")
def build_ui() -> None:
    """Construct the NiceGUI page layout for each browser client."""
    _ensure_shared_assets()

    refs: dict[str, Any] = {}
    client = context.client
    cid = client.id
    client_refs[cid] = refs

    def _unregister() -> None:
        client_refs.pop(cid, None)

    client.on_delete(_unregister)

    # ── Outer wrapper ──────────────────────────────────────────────────────
    with ui.column().style(
        "background:#080c14; min-height:100vh; padding:20px 24px; "
        "align-items:center; gap:0; width:100%; box-sizing:border-box"
    ):

        # ── Header row ─────────────────────────────────────────────────────
        with ui.row().style(
            "width:100%; max-width:1140px; align-items:center; "
            "justify-content:space-between; margin-bottom:14px; gap:12px"
        ):
            ui.label("SPLATBOT").classes("sb-cond").style(
                "font-size:2rem; font-weight:700; letter-spacing:0.2em; color:#dde8f0"
            )
            refs["status"] = ui.label("● PAUSED").style(
                "color:#4a6080; font-family:'Share Tech Mono',monospace; "
                "font-size:0.75rem; letter-spacing:0.2em"
            )
            with ui.row().style("align-items:center; gap:8px"):
                ui.button("▶  START", on_click=_start).classes("sb-btn").props(
                    "flat dense unelevated"
                )
                ui.button("⏸  PAUSE", on_click=_pause).classes("sb-btn").props(
                    "flat dense unelevated"
                )
                ui.button("↺  RESET", on_click=_reset).classes("sb-btn").props(
                    "flat dense unelevated"
                )

        # ── Main row: P1 panel | hex grid | P2 panel ───────────────────────
        with ui.row().style(
            "width:100%; max-width:1140px; align-items:flex-start; gap:12px"
        ):

            with ui.card().classes("sb-card").style(
                "width:190px; flex-shrink:0; padding:18px 16px"
            ):
                ui.label("PLAYER  1").classes("sb-label-xs").style(
                    "color:#7a2e10; margin-bottom:4px"
                )
                refs["score_1"] = (
                    ui.label("0").classes("sb-score").style("color:#ff6b2b")
                )
                refs["pct_1"] = (
                    ui.label("0.0%")
                    .classes("sb-label-xs")
                    .style("color:#7a3010; margin-top:2px; margin-bottom:10px")
                )
                refs["decision_time_1"] = (
                    ui.label("0.00000s/dec")
                    .classes("sb-label-xs")
                    .style("color:#7a3010; margin-top:2px; margin-bottom:10px")
                )
                ui.separator().classes("sb-divider").style("margin-bottom:10px")
                ui.label("BOT FILE").classes("sb-label-xs")
                refs["bot_input_1"] = (
                    ui.input(placeholder="path/to/p1_bot.py")
                    .classes("sb-input")
                    .props("dense borderless")
                    .style("width:100%; margin-top:4px")
                )
                ui.label("DEMO MODE").classes("sb-label-xs").style(
                    "color:#226644; margin-top:8px"
                )

            with ui.element("div").style(
                "flex:1; min-width:0; display:flex; flex-direction:column"
            ):
                refs["hex"] = ui.html(
                    render_hex_grid(GameStateSingleton().current, config.HEX_SIZE)
                ).classes("hex-wrap")

            with ui.card().classes("sb-card").style(
                "width:190px; flex-shrink:0; padding:18px 16px"
            ):
                ui.label("PLAYER  2").classes("sb-label-xs").style(
                    "color:#0a4a5c; margin-bottom:4px"
                )
                refs["score_2"] = (
                    ui.label("0").classes("sb-score").style("color:#00d4ff")
                )
                refs["pct_2"] = (
                    ui.label("0.0%")
                    .classes("sb-label-xs")
                    .style("color:#0a3a4c; margin-top:2px; margin-bottom:10px")
                )
                refs["decision_time_2"] = (
                    ui.label("0.00000s/dec")
                    .classes("sb-label-xs")
                    .style("color:#0a3a4c; margin-top:2px; margin-bottom:10px")
                )
                ui.separator().classes("sb-divider").style("margin-bottom:10px")
                ui.label("BOT FILE").classes("sb-label-xs")
                refs["bot_input_2"] = (
                    ui.input(placeholder="path/to/p2_bot.py")
                    .classes("sb-input")
                    .props("dense borderless")
                    .style("width:100%; margin-top:4px")
                )
                ui.label("DEMO MODE").classes("sb-label-xs").style(
                    "color:#226644; margin-top:8px"
                )

        with ui.row().style(
            "width:100%; max-width:1140px; align-items:center; "
            "gap:12px; margin-top:10px"
        ):
            ui.label("TURN").classes("sb-label-xs").style("flex-shrink:0")
            refs["turn_num"] = ui.label("0").style(
                "font-family:'Share Tech Mono',monospace; font-size:0.85rem; "
                "color:#8899aa; flex-shrink:0; min-width:30px"
            )
            ui.label(f"/ {config.MAX_TURNS}").style(
                "font-family:'Share Tech Mono',monospace; font-size:0.85rem; "
                "color:#2e4060; flex-shrink:0"
            )
            refs["progress"] = (
                ui.linear_progress(value=0, size="4px")
                .classes("sb-progress")
                .style("flex:1; border-radius:2px; overflow:hidden")
            )
            ui.label("SPEED").classes("sb-label-xs").style("flex-shrink:0")
            ui.slider(
                min=1, max=20, step=1, value=7, on_change=lambda e: _set_speed(e.value)
            ).classes("sb-slider").style("width:120px; flex-shrink:0")

        build_event_console(refs)

    _push()
    log_event("Splatbot ready — press START to begin demo.")
