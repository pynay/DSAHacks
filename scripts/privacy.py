"""Face-blur geometry helpers (pure; the bridge applies the actual pixelation).

Face boxes refresh at inference rate (~8fps) while frames render at ~30fps, so
blur regions are padded generously to cover subject motion between updates.
"""


def pad_and_clamp(box, frame_w, frame_h, pad=0.4):
    """Grow a box by `pad` (fraction of its size, split per side), clamped to the frame."""
    w, h = box.get("width", 0), box.get("height", 0)
    px, py = w * pad / 2, h * pad / 2
    x0 = max(0, int(box.get("x", 0) - px))
    y0 = max(0, int(box.get("y", 0) - py))
    x1 = min(frame_w, int(box.get("x", 0) + w + px))
    y1 = min(frame_h, int(box.get("y", 0) + h + py))
    return (x0, y0, max(x0, x1), max(y0, y1))


def head_region(person_box):
    """Fallback when no face detector runs: central 60% width, top 30% height of a person box."""
    w, h = person_box.get("width", 0), person_box.get("height", 0)
    head_w, head_h = int(w * 0.6), int(h * 0.3)
    return {"x": int(person_box.get("x", 0) + (w - head_w) / 2),
            "y": int(person_box.get("y", 0)),
            "width": head_w, "height": head_h}
