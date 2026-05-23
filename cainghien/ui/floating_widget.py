from PySide6 import QtCore, QtGui, QtWidgets
import re
from datetime import datetime, timedelta

class FloatingFocusWidget(QtWidgets.QWidget):
    def __init__(self) -> None:
        super().__init__()
        self._setup_window()
        self._build_ui()
        self._target_time: datetime | None = None
        self._timer = QtCore.QTimer(self)
        self._timer.timeout.connect(self._update_countdown)
        self._timer.start(1000)

    def _setup_window(self) -> None:
        self.setWindowFlags(
            QtCore.Qt.WindowType.Tool
            | QtCore.Qt.WindowType.FramelessWindowHint
            | QtCore.Qt.WindowType.WindowStaysOnTopHint
            | QtCore.Qt.WindowType.WindowTransparentForInput
        )
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
        self.setFocusPolicy(QtCore.Qt.FocusPolicy.NoFocus)

    def _build_ui(self) -> None:
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)

        # Transparent dark card
        self.card = QtWidgets.QFrame()
        self.card.setStyleSheet("""
            QFrame {
                background-color: rgba(18, 18, 18, 200);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 30);
            }
        """)
        card_layout = QtWidgets.QVBoxLayout(self.card)
        card_layout.setContentsMargins(15, 10, 15, 10)

        self.time_label = QtWidgets.QLabel("00:00")
        self.time_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.time_label.setStyleSheet("color: white; font-size: 24px; font-weight: bold; font-family: monospace;")
        card_layout.addWidget(self.time_label)
        
        self.status_label = QtWidgets.QLabel("BẢO VỆ NGHIÊM KHẮC")
        self.status_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.status_label.setStyleSheet("color: #a0a0a0; font-size: 10px; font-weight: bold; letter-spacing: 1px;")
        card_layout.addWidget(self.status_label)

        layout.addWidget(self.card)

    def update_status(self, label_text: str, is_active: bool) -> None:
        if not is_active:
            self.hide()
            self._target_time = None
            return

        # Try to parse time from label_text
        # e.g. "Khóa tức thì đến 14:30" or "08:00 -> 12:00"
        time_match = re.search(r'([0-9]{2}):([0-9]{2})', label_text)
        if time_match:
            now = datetime.now()
            target_hour = int(time_match.group(1))
            target_minute = int(time_match.group(2))
            
            # If the format is "start -> end", we want the end time
            matches = re.findall(r'([0-9]{2}):([0-9]{2})', label_text)
            if len(matches) >= 2:
                target_hour = int(matches[-1][0])
                target_minute = int(matches[-1][1])
                
            self._target_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            if self._target_time < now:
                self._target_time += timedelta(days=1)
        else:
            self._target_time = None
            self.time_label.setText("CỐ ĐỊNH")

        self.adjustSize()
        self._reposition()
        
        if not self.isVisible():
            self.show()

    def _update_countdown(self) -> None:
        if not self.isVisible():
            return
        
        if self._target_time:
            now = datetime.now()
            diff = self._target_time - now
            if diff.total_seconds() > 0:
                hours, remainder = divmod(int(diff.total_seconds()), 3600)
                minutes, seconds = divmod(remainder, 60)
                if hours > 0:
                    self.time_label.setText(f"{hours:02d}:{minutes:02d}:{seconds:02d}")
                else:
                    self.time_label.setText(f"{minutes:02d}:{seconds:02d}")
            else:
                self.time_label.setText("00:00")

    def _reposition(self) -> None:
        screen = QtGui.QGuiApplication.primaryScreen().geometry()
        # Top center
        x = screen.x() + (screen.width() - self.width()) // 2
        y = screen.y() + 20
        self.move(x, y)
