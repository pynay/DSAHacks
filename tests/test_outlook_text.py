"""Dict-in/string-out unit tests for ml/outlook.py's text formatters. These are pure
string-formatting functions over small ITS result dicts -- no model fitting involved."""
from ml.outlook import _continuation_phrase, _fmt_post_line, _read_together


def _term(estimate, ci_lo, ci_hi, p=0.001):
    return {"estimate": estimate, "ci_lo": ci_lo, "ci_hi": ci_hi, "p": p}


def _its(post, post_t, pre_mean=None):
    return {"post": post, "post_t": post_t, "pre_mean": pre_mean}


def test_fmt_post_line_is_counterfactual_relative_and_names_the_denominator():
    # DSDP-shaped: negative post, slope in the same direction but comparable to its
    # placebo (so the continuation clause must not assert persistence -- F5).
    r = _its(_term(-421, -606, -236), _term(-41.6, -52.7, -30.5), pre_mean=1048.8)
    p = _its(_term(83, -52, 219, p=0.23), _term(-29.1, -43.9, -14.3))
    line = _fmt_post_line("Counted units (DSDP)", "units", r, p)
    assert "-421 units lower than the pre-ban trend projected for Aug 2023" in line
    assert "of the 2021" in line and "average monthly count" in line  # names the % base
    assert "-40%" in line
    assert "not distinguishable from noise" in line  # F5: no persistence claim asserted
    assert "and stayed lower" not in line
    assert "survives the placebo check" in line


def test_fmt_post_line_flags_placebo_not_distinguishable():
    # Placebo moves the same direction and is a comparable magnitude -> the real
    # estimate should read as not clearly distinguishable from placebo noise.
    r = _its(_term(100, 20, 180), _term(5, -5, 15), pre_mean=500)
    p = _its(_term(90, 10, 170, p=0.02), _term(4, -6, 14))
    line = _fmt_post_line("311 reports", "reports/month", r, p)
    assert "is not clearly distinguishable from placebo noise" in line
    assert "survives the placebo check" not in line


def test_continuation_phrase_gated_on_slope_noise():
    # Same-direction post/post_t, but the placebo slope is a comparable magnitude to
    # the real slope -> gate on _slope_comparable, don't assert persistence (F5).
    r_noisy = _its(_term(-421, -606, -236), _term(-41.6, -52.7, -30.5), pre_mean=1048.8)
    p_noisy = _its(_term(83, -52, 219), _term(-29.1, -43.9, -14.3))
    assert _continuation_phrase(r_noisy, p_noisy) == " (subsequent trend not distinguishable from noise)"

    # Same-direction post/post_t, placebo slope small relative to the real slope ->
    # the persistence claim is safe to make.
    r_clean = _its(_term(-421, -606, -236), _term(-41.6, -52.7, -30.5), pre_mean=1048.8)
    p_clean = _its(_term(83, -52, 219), _term(-2.0, -6.0, 2.0))
    assert _continuation_phrase(r_clean, p_clean) == " and stayed lower"


def test_read_together_names_both_series_and_avoids_persistence_overclaim():
    r_d = _its(_term(-421, -606, -236), _term(-41.6, -52.7, -30.5), pre_mean=1048.8)
    p_d = _its(_term(83, -52, 219), _term(-29.1, -43.9, -14.3))
    r_r = _its(_term(303, 52, 553), _term(-29.8, -41.5, -18.1), pre_mean=551.3)
    p_r = _its(_term(-203, -471, 65), _term(-8.8, -39.8, 22.2))
    text = _read_together(r_d, p_d, r_r, p_r)
    assert "Counted units fell" in text and "311 reports jumped" in text
    assert "not distinguishable from noise" in text  # DSDP slope gated per F5
    assert "and stayed lower" not in text
