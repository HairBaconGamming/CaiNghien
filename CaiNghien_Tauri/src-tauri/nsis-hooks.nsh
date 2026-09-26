!macro NSIS_HOOK_PREINSTALL
  ; Kill the running application processes before installing/updating
  nsExec::ExecToStack 'cmd /c taskkill /F /IM "cainghien_tauri.exe" /T'
  Pop $0
  Pop $1
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Kill the running application processes multiple times to prevent watchdog race condition
  nsExec::ExecToStack 'cmd /c taskkill /F /IM "cainghien_tauri.exe" /T'
  Pop $0
  Pop $1
  Sleep 1000
  nsExec::ExecToStack 'cmd /c taskkill /F /IM "cainghien_tauri.exe" /T'
  Pop $0
  Pop $1
  
  ; Remove the autostart registry key created by tauri-plugin-autostart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "cainghien_tauri"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.cainghien.desktop"
!macroend
