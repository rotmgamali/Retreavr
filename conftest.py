"""Root conftest: stub out optional dependencies missing from the test env.

Some packages (pdfplumber, asyncpg, pgvector) are listed in requirements.txt
but may not be installed in a lightweight test environment. We stub them here
so that unit tests for pure-Python logic can run without the full stack.
"""

import sys
from unittest.mock import MagicMock

# Packages that may be absent in a lightweight test environment
_OPTIONAL_STUBS = [
    "pdfplumber",
    "asyncpg",
    "pgvector",
    "tiktoken",
]

for _pkg in _OPTIONAL_STUBS:
    if _pkg not in sys.modules:
        try:
            __import__(_pkg)
        except ImportError:
            sys.modules[_pkg] = MagicMock()
