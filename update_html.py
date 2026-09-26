import os

with open('web/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_link = '<link rel="icon" type="image/png" href="/assets/CaiNghienFocusGuard-preview.png" />'
new_link = '<link rel="icon" type="image/x-icon" href="/favicon.ico" />\n    <link rel="apple-touch-icon" href="/logo.png" />'

html = html.replace(old_link, new_link)

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
