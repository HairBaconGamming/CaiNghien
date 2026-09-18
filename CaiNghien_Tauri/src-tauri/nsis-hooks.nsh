!macro NSIS_HOOK_PREUNINSTALL
  ; Kill the running application processes multiple times to prevent watchdog race condition
  nsExec::Exec 'taskkill /F /IM "cainghien_tauri.exe" /T'
  Pop $0
  Sleep 1000
  nsExec::Exec 'taskkill /F /IM "cainghien_tauri.exe" /T'
  Pop $0
  
  ; Remove the autostart registry key created by tauri-plugin-autostart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "cainghien_tauri"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.cainghien.desktop"
!macroend
