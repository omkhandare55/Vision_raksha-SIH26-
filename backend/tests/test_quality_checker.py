# backend/tests/test_quality_checker.py
import io, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
from PIL import Image
from ai.quality_checker import QualityChecker, QualityAction


def _make_image_bytes(h=380, w=380, bright=True) -> bytes:
    """Create a synthetic fundus-like image."""
    if bright:
        arr = np.random.randint(80, 180, (h, w, 3), dtype=np.uint8)
        # Add circular retina mask (coverage)
        cy, cx = h//2, w//2
        Y, X = np.ogrid[:h, :w]
        mask = (X-cx)**2 + (Y-cy)**2 <= (min(h,w)//2 - 10)**2
        arr[~mask] = 0
    else:
        arr = np.zeros((h, w, 3), dtype=np.uint8)  # black = bad
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_bright_image_accepted():
    qc = QualityChecker()
    result = qc.assess(_make_image_bytes(bright=True))
    assert result.score >= 0.5
    assert result.action in (QualityAction.ACCEPT, QualityAction.ENHANCE)
    print(f"  score={result.score} action={result.action}")


def test_black_image_rejected():
    qc = QualityChecker()
    result = qc.assess(_make_image_bytes(bright=False))
    assert result.action == QualityAction.REJECT
    print(f"  score={result.score} action={result.action}")


def test_rejection_message_returned():
    qc = QualityChecker()
    result = qc.assess(_make_image_bytes(bright=False))
    msgs = qc.get_rejection_message(result.details)
    assert len(msgs) > 0
    print(f"  messages={msgs}")


if __name__ == "__main__":
    print("Running quality_checker tests...")
    test_bright_image_accepted()
    print("  ✅ test_bright_image_accepted")
    test_black_image_rejected()
    print("  ✅ test_black_image_rejected")
    test_rejection_message_returned()
    print("  ✅ test_rejection_message_returned")
    print("All tests passed.")
