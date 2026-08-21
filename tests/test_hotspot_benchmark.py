from dataclasses import replace

import numpy as np

from ml.hotspot_benchmark import MIN_LAG, features_at, load_panel, training_rows


def test_hotspot_panel_is_complete_and_nonnegative():
    panel = load_panel()
    assert panel.values.shape == (50, 287)
    assert len(panel.months) == 50
    assert panel.imputed_month.sum() == 3
    assert np.isfinite(panel.values).all()
    assert (panel.values >= 0).all()
    assert np.allclose(panel.adjacency.sum(axis=1), 1)


def test_features_and_training_rows_do_not_read_future_targets():
    panel = load_panel()
    stop = MIN_LAG + 6
    x_before, y_before, t_before = training_rows(panel, stop)
    test_before = features_at(panel, stop)

    changed_values = panel.values.copy()
    changed_values[stop:] += 10_000
    changed = replace(panel, values=changed_values)
    x_after, y_after, t_after = training_rows(changed, stop)
    test_after = features_at(changed, stop)

    np.testing.assert_allclose(x_before, x_after)
    np.testing.assert_allclose(y_before, y_after)
    np.testing.assert_array_equal(t_before, t_after)
    np.testing.assert_allclose(test_before, test_after)
