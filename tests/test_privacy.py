"""Face-blur geometry: padded blur regions and person-box head fallback."""
from scripts.privacy import head_regions, pad_and_clamp

W, H = 1920, 1080


def test_pad_grows_box_symmetrically():
    # 200x200 box padded 40% -> 280x280, centered on the same spot
    assert pad_and_clamp({"x": 100, "y": 100, "width": 200, "height": 200}, W, H, pad=0.4) == (60, 60, 340, 340)


def test_pad_clamps_at_frame_edges():
    x0, y0, x1, y1 = pad_and_clamp({"x": 10, "y": 10, "width": 100, "height": 100}, W, H, pad=1.0)
    assert (x0, y0) == (0, 0)
    assert x1 <= W and y1 <= H


def test_pad_zero_size_box_is_empty():
    x0, y0, x1, y1 = pad_and_clamp({"x": 50, "y": 50, "width": 0, "height": 0}, W, H, pad=0.4)
    assert x0 == x1 and y0 == y1


def test_head_regions_upright_person_is_top_center():
    # standing person 300x800 at (500,200): head = central 60% width, top 30% height
    assert head_regions({"x": 500, "y": 200, "width": 300, "height": 800}) == \
        [{"x": 560, "y": 200, "width": 180, "height": 240}]


def test_head_regions_lying_person_covers_both_ends():
    # lying person 900x300 at (500,800): head is at one end but we can't know
    # which, so blur both ends (30% width each, full height)
    assert head_regions({"x": 500, "y": 800, "width": 900, "height": 300}) == [
        {"x": 500, "y": 800, "width": 270, "height": 300},
        {"x": 1130, "y": 800, "width": 270, "height": 300},
    ]
