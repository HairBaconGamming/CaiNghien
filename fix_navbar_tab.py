import os

with open('CaiNghien_Tauri/src/components/layout/Navbar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("export type NavTabId = 'dashboard' | 'focus' | 'typing' | 'settings' | 'account';", "export type NavTabId = 'dashboard' | 'focus' | 'typing' | 'settings';")
text = text.replace("{ id: 'account', label: 'Tài khoản', icon: User },", "")

with open('CaiNghien_Tauri/src/components/layout/Navbar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
