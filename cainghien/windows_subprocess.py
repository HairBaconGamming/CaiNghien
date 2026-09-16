from __future__ import annotations

import os
import subprocess
from typing import Any


def hidden_window_kwargs(**kwargs: Any) -> dict[str, Any]:
    options = dict(kwargs)
    if os.name != "nt":
        return options

    create_no_window = int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
    options["creationflags"] = int(options.get("creationflags", 0)) | create_no_window

    if options.get("startupinfo") is None:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
        startupinfo.wShowWindow = 0
        options["startupinfo"] = startupinfo
    return options


def run_hidden(command: list[str], /, **kwargs: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, **hidden_window_kwargs(**kwargs))

