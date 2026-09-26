import re

path = 'CaiNghien_Tauri/src-tauri/src/enforcement.rs'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Add enforce_window_lock
if 'fn enforce_window_lock' not in code:
    kill_fn = '''
pub fn enforce_window_lock(pid: u32) {
    let _ = Command::new("taskkill")
        .args(&["/F", "/PID", &pid.to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}
'''
    code = code.replace('pub fn watchdog_loop', kill_fn + '\npub fn watchdog_loop')

# Fix trigger lockscreen
if 'let _ = app.emit("trigger-lockscreen"' in code and 'enforce_window_lock(' not in code:
    code = code.replace(
        '// TRIGGER LOCKSCREEN\n                                let _ = app.emit("trigger-lockscreen", ());',
        '// TRIGGER LOCKSCREEN\n                                enforce_window_lock(window.pid as u32);\n                                let _ = app.emit("trigger-lockscreen", ());'
    )

hosts_sync_pattern = r'let result = if effective_hosts_protection \{[\s\S]*?hosts_retry_cooldown = 60;\n\s*\}\n\s*\}'
replacement_hosts = '''// Run hosts block in a separate thread to prevent UAC blocking the main loop
                    let domains_clone = domains.clone();
                    thread::spawn(move || {
                        let _ = if effective_hosts_protection {
                            apply_hosts_block(&domains_clone)
                        } else {
                            apply_hosts_block(&[])
                        };
                    });
                    
                    // Optimistically update states so we don't spawn threads every second
                    last_protection_state = Some(effective_hosts_protection);
                    if effective_hosts_protection {
                        last_domains = Some(domains.clone());
                    } else {
                        last_domains = Some(vec![]);
                    }
                }'''
code = re.sub(hosts_sync_pattern, replacement_hosts, code)

dns_sync_pattern = r'if last_nsfw_state != Some\(should_apply_dns\) \{\n\s*apply_family_dns\(should_apply_dns\);\n\s*last_nsfw_state = Some\(should_apply_dns\);\n\s*\}'
replacement_dns = '''if last_nsfw_state != Some(should_apply_dns) {
                    thread::spawn(move || {
                        apply_family_dns(should_apply_dns);
                    });
                    last_nsfw_state = Some(should_apply_dns);
                }'''
code = re.sub(dns_sync_pattern, replacement_dns, code)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print('Patched enforcement.rs')
