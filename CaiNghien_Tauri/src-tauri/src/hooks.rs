use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use windows::core::w;
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, FindWindowW, GetMessageW, PostThreadMessageW, SetWindowsHookExW, ShowWindow,
    UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG, SW_HIDE, SW_SHOW, WH_KEYBOARD_LL,
    WH_MOUSE_LL, WM_QUIT,
};

static IS_LOCKED: AtomicBool = AtomicBool::new(false);
static HOOK_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static LOCK_EPOCH: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static LOCK_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

static KIOSK_ACTIVE: AtomicBool = AtomicBool::new(false);
static KIOSK_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
static KIOSK_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

const VK_TAB: u32 = 0x09;
const VK_ESCAPE: u32 = 0x1B;
const VK_CONTROL: i32 = 0x11;
const VK_LWIN: u32 = 0x5B;
const VK_RWIN: u32 = 0x5C;
const LLKHF_ALTDOWN: u32 = 0x20;

extern "system" {
    fn GetAsyncKeyState(vKey: i32) -> i16;
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && IS_LOCKED.load(Ordering::Relaxed) {
        return LRESULT(1);
    }
    CallNextHookEx(Some(HHOOK::default()), code, wparam, lparam)
}

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && IS_LOCKED.load(Ordering::Relaxed) {
        return LRESULT(1);
    }
    CallNextHookEx(Some(HHOOK::default()), code, wparam, lparam)
}

unsafe extern "system" fn kiosk_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 && KIOSK_ACTIVE.load(Ordering::Relaxed) {
        let ptr = lparam.0 as *const KBDLLHOOKSTRUCT;
        if ptr.is_null() {
            return CallNextHookEx(Some(HHOOK::default()), code, wparam, lparam);
        }
        let kbd = *ptr;
        let vk = kbd.vkCode;
        let alt_down = (kbd.flags.0 & LLKHF_ALTDOWN) != 0;

        // 1. Suppress Windows Keys (Start menu, Win shortcuts)
        if vk == VK_LWIN || vk == VK_RWIN {
            return LRESULT(1);
        }

        // 2. Suppress Alt + Tab
        if vk == VK_TAB && alt_down {
            return LRESULT(1);
        }

        // 3. Suppress Alt + Esc
        if vk == VK_ESCAPE && alt_down {
            return LRESULT(1);
        }

        // 4. Suppress Ctrl + Esc (Start menu alternative)
        if vk == VK_ESCAPE {
            let ctrl_down = (GetAsyncKeyState(VK_CONTROL) as u16 & 0x8000) != 0;
            if ctrl_down {
                return LRESULT(1);
            }
        }
    }
    CallNextHookEx(Some(HHOOK::default()), code, wparam, lparam)
}

pub fn set_taskbar_visible(visible: bool) {
    unsafe {
        let cmd = if visible { SW_SHOW } else { SW_HIDE };
        if let Ok(primary) = FindWindowW(w!("Shell_TrayWnd"), None) {
            if !primary.0.is_null() {
                let _ = ShowWindow(primary, cmd);
            }
        }
        if let Ok(secondary) = FindWindowW(w!("Shell_SecondaryTrayWnd"), None) {
            if !secondary.0.is_null() {
                let _ = ShowWindow(secondary, cmd);
            }
        }
    }
}

pub fn start_kiosk_hook() {
    let _guard = KIOSK_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    if KIOSK_ACTIVE.swap(true, Ordering::Relaxed) {
        return;
    }

    let (tx, rx) = std::sync::mpsc::channel();

    thread::spawn(move || {
        let h_instance = unsafe { GetModuleHandleW(None).unwrap_or_default() };
        let k_hook = unsafe {
            SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(kiosk_keyboard_proc),
                Some(h_instance.into()),
                0,
            )
            .ok()
        };

        unsafe {
            let mut msg = MSG::default();
            let _ = windows::Win32::UI::WindowsAndMessaging::PeekMessageW(
                &mut msg,
                None,
                0,
                0,
                windows::Win32::UI::WindowsAndMessaging::PM_NOREMOVE,
            );
            KIOSK_THREAD_ID.store(
                windows::Win32::System::Threading::GetCurrentThreadId(),
                Ordering::Relaxed,
            );
        }

        let _ = tx.send(());

        let mut msg = MSG::default();
        unsafe {
            loop {
                let res = GetMessageW(&mut msg, None, 0, 0);
                if res.0 == 0 || res.0 == -1 {
                    break;
                }
                if msg.message == WM_QUIT {
                    break;
                }
                let _ = windows::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
                windows::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
            }
            if let Some(hook) = k_hook {
                let _ = UnhookWindowsHookEx(hook);
            }
        }
    });

    let _ = rx.recv();
}

pub fn stop_kiosk_hook() {
    let _guard = KIOSK_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    if !KIOSK_ACTIVE.swap(false, Ordering::Relaxed) {
        return;
    }
    let tid = KIOSK_THREAD_ID.swap(0, Ordering::Relaxed);
    if tid != 0 {
        unsafe {
            let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
}

#[tauri::command]
pub fn lock_hardware_input() {
    let _guard = LOCK_MUTEX.lock().unwrap_or_else(|e| e.into_inner());

    LOCK_EPOCH.fetch_add(1, Ordering::Relaxed);

    if IS_LOCKED.swap(true, Ordering::Relaxed) {
        return;
    }

    // Safety 1: Detached safety thread that unhooks after 65 seconds of inactivity
    thread::spawn(move || loop {
        let current_epoch = LOCK_EPOCH.load(Ordering::Relaxed);
        thread::sleep(Duration::from_secs(65));
        if !IS_LOCKED.load(Ordering::Relaxed) {
            break;
        }
        if LOCK_EPOCH.load(Ordering::Relaxed) == current_epoch {
            unlock_hardware_input();
            break;
        }
    });

    let (tx, rx) = std::sync::mpsc::channel();

    thread::spawn(move || {
        let h_instance = unsafe { GetModuleHandleW(None).unwrap_or_default() };

        let k_hook = unsafe {
            SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_proc),
                Some(h_instance.into()),
                0,
            )
            .unwrap()
        };
        let m_hook = unsafe {
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), Some(h_instance.into()), 0).unwrap()
        };

        unsafe {
            let mut msg = MSG::default();
            let _ = windows::Win32::UI::WindowsAndMessaging::PeekMessageW(
                &mut msg,
                None,
                0,
                0,
                windows::Win32::UI::WindowsAndMessaging::PM_NOREMOVE,
            );
            HOOK_THREAD_ID.store(
                windows::Win32::System::Threading::GetCurrentThreadId(),
                Ordering::Relaxed,
            );
        }

        let _ = tx.send(());

        let mut msg = MSG::default();
        unsafe {
            loop {
                let res = GetMessageW(&mut msg, None, 0, 0);
                if res.0 == 0 || res.0 == -1 {
                    break;
                }
                if msg.message == WM_QUIT {
                    break;
                }
                let _ = windows::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
                windows::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
            }
            let _ = UnhookWindowsHookEx(k_hook);
            let _ = UnhookWindowsHookEx(m_hook);
        }
    });

    let _ = rx.recv();
}

#[tauri::command]
pub fn unlock_hardware_input() {
    let _guard = LOCK_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    if !IS_LOCKED.swap(false, Ordering::Relaxed) {
        return;
    }
    let tid = HOOK_THREAD_ID.swap(0, Ordering::Relaxed);
    if tid != 0 {
        unsafe {
            let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
}

pub struct DropGuard;

impl Drop for DropGuard {
    fn drop(&mut self) {
        unlock_hardware_input();
        stop_kiosk_hook();
        set_taskbar_visible(true);
        crate::enforcement::unlock_hosts();
    }
}

pub fn init_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        unlock_hardware_input();
        stop_kiosk_hook();
        set_taskbar_visible(true);
        crate::enforcement::unlock_hosts();
        default_hook(panic_info);
    }));
}
