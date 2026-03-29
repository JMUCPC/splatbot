from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import re

import config
from engine.hex_grid import Hex


@dataclass(frozen=True)
class SettingSpec:
    key: str
    kind: str  # int | float | enum | color
    minimum: float | None = None
    maximum: float | None = None
    step: float | None = None
    choices: tuple[str, ...] = ()


SETTINGS_STORAGE_KEY = "settings_overrides_v1"

_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

SETTING_SPECS: tuple[SettingSpec, ...] = (
    SettingSpec("GRID_RADIUS", kind="int", minimum=2, maximum=20, step=1),
    SettingSpec("MAX_TURNS", kind="int", minimum=1, maximum=10000, step=1),
    SettingSpec("TICK_DELAY", kind="float", minimum=0.01, maximum=5.0, step=0.01),
    SettingSpec("TIMEOUT", kind="float", minimum=0.6, maximum=30.0, step=0.1),
    SettingSpec("BOT_DISPLAY_TYPE", kind="enum", choices=("circles", "triangles")),
    SettingSpec("PLAYER_TILE_COLORS.1", kind="color"),
    SettingSpec("PLAYER_TILE_COLORS.2", kind="color"),
    SettingSpec("PLAYER_BOT_COLORS.1", kind="color"),
    SettingSpec("PLAYER_BOT_COLORS.2", kind="color"),
    SettingSpec("PLAYER_BRIGHT_COLORS.1", kind="color"),
    SettingSpec("PLAYER_BRIGHT_COLORS.2", kind="color"),
    SettingSpec("TILE_NONE_COLOR", kind="color"),
    SettingSpec("TILE_STROKE_COLOR", kind="color"),
    SettingSpec("CANVAS_BG", kind="color"),
)

_SPEC_BY_KEY = {spec.key: spec for spec in SETTING_SPECS}

_BASE_DEFAULTS: dict[str, Any] = {
    "GRID_RADIUS": config.GRID_RADIUS,
    "MAX_TURNS": config.MAX_TURNS,
    "TICK_DELAY": config.TICK_DELAY,
    "TIMEOUT": config.TIMEOUT,
    "BOT_DISPLAY_TYPE": config.BOT_DISPLAY_TYPE,
    "PLAYER_TILE_COLORS.1": config.PLAYER_TILE_COLORS[1],
    "PLAYER_TILE_COLORS.2": config.PLAYER_TILE_COLORS[2],
    "PLAYER_BOT_COLORS.1": config.PLAYER_BOT_COLORS[1],
    "PLAYER_BOT_COLORS.2": config.PLAYER_BOT_COLORS[2],
    "PLAYER_BRIGHT_COLORS.1": config.PLAYER_BRIGHT_COLORS[1],
    "PLAYER_BRIGHT_COLORS.2": config.PLAYER_BRIGHT_COLORS[2],
    "TILE_NONE_COLOR": config.TILE_NONE_COLOR,
    "TILE_STROKE_COLOR": config.TILE_STROKE_COLOR,
    "CANVAS_BG": config.CANVAS_BG,
}


def default_flat_settings() -> dict[str, Any]:
    return _BASE_DEFAULTS.copy()


def coerce_setting(key: str, raw_value: Any) -> Any:
    spec = _SPEC_BY_KEY[key]
    if spec.kind == "int":
        value = int(raw_value)
        if spec.minimum is not None and value < spec.minimum:
            raise ValueError(f"{key} must be >= {int(spec.minimum)}")
        if spec.maximum is not None and value > spec.maximum:
            raise ValueError(f"{key} must be <= {int(spec.maximum)}")
        return value

    if spec.kind == "float":
        value = float(raw_value)
        if spec.minimum is not None and value < spec.minimum:
            raise ValueError(f"{key} must be >= {spec.minimum}")
        if spec.maximum is not None and value > spec.maximum:
            raise ValueError(f"{key} must be <= {spec.maximum}")
        return value

    if spec.kind == "enum":
        value = str(raw_value)
        if value not in spec.choices:
            raise ValueError(f"{key} must be one of: {', '.join(spec.choices)}")
        return value

    if spec.kind == "color":
        value = str(raw_value).strip()
        if not _COLOR_RE.match(value):
            raise ValueError(f"{key} must be a hex color like #AABBCC")
        return value.lower()

    raise ValueError(f"Unsupported setting type for {key}")


def validate_overrides(raw_overrides: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    clean: dict[str, Any] = {}
    errors: list[str] = []
    for key, raw_value in raw_overrides.items():
        if key not in _SPEC_BY_KEY:
            errors.append(f"Unknown setting: {key}")
            continue
        try:
            clean[key] = coerce_setting(key, raw_value)
        except Exception as exc:
            errors.append(str(exc))
    return clean, errors


def merge_with_defaults(overrides: dict[str, Any]) -> dict[str, Any]:
    merged = default_flat_settings()
    clean, _ = validate_overrides(overrides)
    merged.update(clean)
    return merged


def apply_flat_settings_to_config(flat_settings: dict[str, Any]) -> None:
    values = merge_with_defaults(flat_settings)
    config.GRID_RADIUS = int(values["GRID_RADIUS"])
    config.MAX_TURNS = int(values["MAX_TURNS"])
    config.TICK_DELAY = float(values["TICK_DELAY"])
    config.TIMEOUT = float(values["TIMEOUT"])
    config.BOT_DISPLAY_TYPE = str(values["BOT_DISPLAY_TYPE"])
    config.PLAYER_TILE_COLORS = {
        1: str(values["PLAYER_TILE_COLORS.1"]),
        2: str(values["PLAYER_TILE_COLORS.2"]),
    }
    config.PLAYER_BOT_COLORS = {
        1: str(values["PLAYER_BOT_COLORS.1"]),
        2: str(values["PLAYER_BOT_COLORS.2"]),
    }
    config.PLAYER_BRIGHT_COLORS = {
        1: str(values["PLAYER_BRIGHT_COLORS.1"]),
        2: str(values["PLAYER_BRIGHT_COLORS.2"]),
    }
    config.TILE_NONE_COLOR = str(values["TILE_NONE_COLOR"])
    config.TILE_STROKE_COLOR = str(values["TILE_STROKE_COLOR"])
    config.CANVAS_BG = str(values["CANVAS_BG"])

    # Keep start positions derived from the currently active grid radius.
    config.START_POS_1 = Hex(-(config.GRID_RADIUS - 1), 0)
    config.START_POS_2 = Hex(config.GRID_RADIUS - 1, 0)
