import re

with open(r'D:\Projects\APPs\CaiNghien-main\.github\workflows\build.yml', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('tagName: app-v__VERSION__', 'tagName: v__VERSION__')

with open(r'D:\Projects\APPs\CaiNghien-main\.github\workflows\build.yml', 'w', encoding='utf-8') as f:
    f.write(text)
