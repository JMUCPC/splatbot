# splatbot

## Development Setup

This project uses Python 3.14.
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
This may resolve a problem with the installation of NiceGUI if the previous command fails.
```bash
pip install nicegui --only-binary=:all:
```

## Running the Game

```bash
python main.py
```

## Settings Menu

- Click `SETTINGS` in the top bar to edit runtime game/render settings.
- Settings are persisted per browser profile via local browser storage.
- `config.py` remains the source of default values and is not rewritten.
- Applied settings affect the live runtime; applying settings resets the current match.