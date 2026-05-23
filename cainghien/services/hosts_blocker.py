from __future__ import annotations

import ctypes
import os
import re
from pathlib import Path
from typing import Iterable

from ..models import dedupe_domains, normalize_domain
from ..windows_subprocess import run_hidden


class HostsBlocker:
    marker_start = "# CAINGHIEN START"
    marker_end = "# CAINGHIEN END"

    def __init__(self, hosts_path: Path | None = None) -> None:
        root = Path(os.environ.get("SystemRoot", r"C:\Windows"))
        self.hosts_path = hosts_path or root / "System32" / "drivers" / "etc" / "hosts"

    @staticmethod
    def is_elevated() -> bool:
        try:
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except Exception:
            return False

    def apply_block(self, domains: Iterable[str]) -> tuple[bool, str]:
        cleaned = self._expand_domains(domains)
        try:
            content = self._read_hosts()
            updated = self._without_marker_block(content).rstrip()
            if cleaned:
                block_lines = [self.marker_start]
                for domain in cleaned:
                    block_lines.append(f"127.0.0.1 {domain}")
                    block_lines.append(f"::1 {domain}")
                block_lines.append(self.marker_end)
                updated = f"{updated}\n\n" + "\n".join(block_lines) + "\n"
            else:
                updated = updated + ("\n" if updated else "")
            self.hosts_path.write_text(updated, encoding="utf-8")
            self._flush_dns()
            return True, "Da cap nhat hosts file."
        except PermissionError:
            return False, "Can mo app bang quyen Admin de sua hosts file."
        except OSError as exc:
            return False, f"Khong the cap nhat hosts: {exc}"

    def remove_block(self) -> tuple[bool, str]:
        try:
            content = self._read_hosts()
            updated = self._without_marker_block(content).rstrip()
            self.hosts_path.write_text(updated + ("\n" if updated else ""), encoding="utf-8")
            self._flush_dns()
            return True, "Da go bo danh sach chan web."
        except PermissionError:
            return False, "Can quyen Admin de go bo chan web."
        except OSError as exc:
            return False, f"Khong the go bo chan web: {exc}"

    def _read_hosts(self) -> str:
        if not self.hosts_path.exists():
            return ""
        return self.hosts_path.read_text(encoding="utf-8", errors="ignore")
    def _without_marker_block(self, content: str) -> str:
        if self.marker_start not in content or self.marker_end not in content:
            return content
        
        # Remove all blocks between marker_start and marker_end inclusive
        pattern = re.escape(self.marker_start) + r".*?" + re.escape(self.marker_end)
        cleaned = re.sub(pattern, "", content, flags=re.DOTALL)
        
        # Clean up excessive newlines that might be left behind
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        return cleaned.strip()

    def _expand_domains(self, domains: Iterable[str]) -> list[str]:
        expanded: list[str] = []
        prefixes = ("www.", "m.", "mobile.")
        for domain in dedupe_domains(list(domains)):
            normalized = normalize_domain(domain)
            if not normalized:
                continue
            expanded.append(normalized)
            if not normalized.startswith(prefixes):
                expanded.extend([f"www.{normalized}", f"m.{normalized}", f"mobile.{normalized}"])
        return dedupe_domains(expanded)

    def _flush_dns(self) -> None:
        try:
            run_hidden(
                ["ipconfig", "/flushdns"],
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
        except Exception:
            pass
