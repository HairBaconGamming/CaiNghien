import sys

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

old_hosts = '''                if (last_protection_state != Some(effective_hosts_protection) || (effective_hosts_protection && domains_changed)) && hosts_retry_cooldown == 0 {
                    let result = if effective_hosts_protection {
                        apply_hosts_block(&domains)
                    } else {
                        apply_hosts_block(&[])
                    };
                    
                    match result {
                        Ok(_) => {
                            last_protection_state = Some(effective_hosts_protection);
                            if effective_hosts_protection {
                                last_domains = Some(domains.clone());
                            } else {
                                last_domains = Some(vec![]);
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to apply hosts block (backing off 60s): {}", e);
                            // Backoff 60 seconds instead of thrashing every 1 second
                            hosts_retry_cooldown = 60;
                        }
                    }
                }'''

new_hosts = '''                if (last_protection_state != Some(effective_hosts_protection) || (effective_hosts_protection && domains_changed)) && hosts_retry_cooldown == 0 {
                    let domains_clone = domains.clone();
                    thread::spawn(move || {
                        let _ = if effective_hosts_protection {
                            apply_hosts_block(&domains_clone)
                        } else {
                            apply_hosts_block(&[])
                        };
                    });
                    
                    last_protection_state = Some(effective_hosts_protection);
                    if effective_hosts_protection {
                        last_domains = Some(domains.clone());
                    } else {
                        last_domains = Some(vec![]);
                    }
                }'''

if old_hosts not in code:
    print("Could not find old hosts block!")
    sys.exit(1)

code = code.replace(old_hosts, new_hosts)

old_dns = '''                // Sync DNS Family Filter
                if last_nsfw_state != Some(should_apply_dns) {
                    apply_family_dns(should_apply_dns);
                    last_nsfw_state = Some(should_apply_dns);
                }'''

new_dns = '''                // Sync DNS Family Filter
                if last_nsfw_state != Some(should_apply_dns) {
                    thread::spawn(move || {
                        apply_family_dns(should_apply_dns);
                    });
                    last_nsfw_state = Some(should_apply_dns);
                }'''

if old_dns not in code:
    print("Could not find old dns block!")
    sys.exit(1)

code = code.replace(old_dns, new_dns)

old_lock = '''                                // TRIGGER LOCKSCREEN
                                let _ = app.emit("trigger-lockscreen", ());'''

new_lock = '''                                // TRIGGER LOCKSCREEN
                                enforce_window_lock(window.pid as u32);
                                let _ = app.emit("trigger-lockscreen", ());'''

if old_lock not in code:
    print("Could not find lockscreen trigger block!")
    sys.exit(1)

code = code.replace(old_lock, new_lock)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch applied successfully.")
