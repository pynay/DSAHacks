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


def head_regions(person_box):
    """Fallback blur zones when no face box matched this person.

    Upright box (taller than wide): the head is at the top — central 60% width,
    top 30% height. Lying box (wider than tall): the head is at one END and we
    cannot know which, so cover both ends (30% width each, full height).
    """
    x, y = person_box.get("x", 0), person_box.get("y", 0)
    w, h = person_box.get("width", 0), person_box.get("height", 0)
    if w >= h:  # lying / crouched sideways
        end_w = int(w * 0.3)
        return [
            {"x": int(x), "y": int(y), "width": end_w, "height": int(h)},
            {"x": int(x + w - end_w), "y": int(y), "width": end_w, "height": int(h)},
        ]
    head_w, head_h = int(w * 0.6), int(h * 0.3)
    return [{"x": int(x + (w - head_w) / 2), "y": int(y), "width": head_w, "height": head_h}]
