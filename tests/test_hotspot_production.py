import numpy as np

from ml.hotspot_production import HOTSPOT_COUNT, choose_centers, load_panel


def test_modern_hotspot_panel_and_center_selection():
    months, grid, values, adjacency, distances = load_panel()
    assert len(months) == 12
    assert values.shape == (12, 261)
    assert len(grid) == 261
    assert np.isfinite(values).all()
    assert (values >= 0).all()
    assert np.allclose(adjacency.sum(axis=1), 1)

    centers = choose_centers(values[-1], distances)
    assert len(centers) == HOTSPOT_COUNT
    for i, center in enumerate(centers):
        assert all(distances[center, other] >= 0.24 for other in centers[:i])
