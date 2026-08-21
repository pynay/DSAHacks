from commons.registry import SOURCES


def test_registry_has_i():
    assert "I" in SOURCES
    assert SOURCES["I"]["signal_type"] == "food_access"
    assert "ers.usda.gov" in SOURCES["I"]["url"]
