"""main.py — Launch the Splatbot GUI.

Run from the project root:
    python main.py

The app opens in your default browser at http://localhost:8080.
Pass native=True to ui.run() below for a frameless desktop-app feel.
"""
from frontend.app import build_ui  # noqa: F401 — registers @ui.page("/")
from nicegui import ui

ui.run(
    title="Splatbot",
    port=8080,
    reload=False,
    show=True,
    native=False,
    dark=True,
    # Wider reconnect window; scales Engine.IO ping/keepalive. If you use a reverse proxy,
    # set its WebSocket proxy_read_timeout (or equivalent) above idle disconnects (often 60s).
    reconnect_timeout=60.0,
)
