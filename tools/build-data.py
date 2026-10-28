"""Wuhan entry point; Shanghai's unmodified generator remains in reference-shanghai."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build-wuhan.py')),run_name='__main__')
