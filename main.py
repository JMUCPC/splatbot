"""main.py — Launch the Splatbot GUI.

Run from the project root:
    python main.py

The app opens in your default browser at http://localhost:8080.
Pass native=True to ui.run() below for a frameless desktop-app feel.
"""
from frontend.app import build_ui
from nicegui import ui

build_ui()

ui.run(
    title="Splatbot",
    port=8080,
    reload=False,
    show=True,          # auto-open browser
    native=False,       # set True for a borderless desktop window
    dark=True,
)
