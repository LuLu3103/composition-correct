#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 README.md 转成静态说明书 manual.html（图片走 github.io，规避 raw.githubusercontent.com 被墙）。"""
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "README.md")
OUT = os.path.join(ROOT, "manual.html")

IMG_BASE = "https://lulu3103.github.io/composition-correct/"
BT = chr(96)


def inline(text):
    slots = {}

    def stash(fragment):
        key = "\x00%d\x00" % len(slots)
        slots[key] = fragment
        return key

    def auto(m):
        url = m.group(1)
        return stash('<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(url, quote=True), html.escape(url)))

    text = re.sub(r"<(https?://[^>\s]+)>", auto, text)
    text = re.sub(BT + "([^" + BT + "]+)" + BT, lambda m: stash("<code>%s</code>" % html.escape(m.group(1))), text)

    def image(m):
        alt, src = m.group(1), m.group(2)
        return stash('<img src="%s" alt="%s" loading="lazy">' % (html.escape(src, quote=True), html.escape(alt, quote=True)))

    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", image, text)

    def link(m):
        label, url = m.group(1), m.group(2)
        return stash('<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(url, quote=True), label))

    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, text)
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*([^*]+)\*\*", lambda m: "<strong>%s</strong>" % m.group(1), text)
    for key, fragment in slots.items():
        text = text.replace(key, fragment)
    return text


def render_table(lines):
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in lines]
    head, body = None, rows
    if len(rows) >= 2 and rows[1] and re.match(r"^:?-{2,}:?$", rows[1][0].replace(" ", "")):
        head, body = rows[0], rows[2:]
    out = ['<div class="table-wrap"><table>']
    if head:
        out.append("<thead><tr>" + "".join("<th>%s</th>" % inline(c) for c in head) + "</tr></thead>")
    out.append("<tbody>")
    for row in body:
        if not any(row):
            continue
        out.append("<tr>" + "".join("<td>%s</td>" % inline(c) for c in row) + "</tr>")
    out.append("</tbody></table></div>")
    return "\n".join(out)


def convert(md):
    lines = md.split("\n")
    out, i, n = [], 0, len(lines)
    while i < n:
        line, stripped = lines[i], lines[i].strip()

        if stripped.startswith(BT * 3):
            buf = []
            i += 1
            while i < n and not lines[i].strip().startswith(BT * 3):
                buf.append(lines[i])
                i += 1
            i += 1
            out.append('<pre class="code"><code>%s</code></pre>' % html.escape("\n".join(buf)))
            continue

        if not stripped:
            i += 1
            continue

        if re.match(r"^---+$", stripped):
            out.append("<hr>")
            i += 1
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (level, inline(m.group(2)), level))
            i += 1
            continue

        if stripped.startswith("|"):
            block = []
            while i < n and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            out.append(render_table(block))
            continue

        if stripped.startswith(">"):
            block = []
            while i < n and lines[i].strip().startswith(">"):
                block.append(lines[i].strip()[1:].strip())
                i += 1
            out.append("<blockquote>%s</blockquote>" % inline(" ".join(block)))
            continue

        if re.match(r"^[-*]\s+", stripped):
            block = []
            while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                block.append(re.sub(r"^\s*[-*]\s+", "", lines[i]))
                i += 1
            out.append("<ul>" + "".join("<li>%s</li>" % inline(x) for x in block) + "</ul>")
            continue

        if re.match(r"^\d+\.\s+", stripped):
            block = []
            while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                block.append(re.sub(r"^\s*\d+\.\s+", "", lines[i]))
                i += 1
            out.append("<ol>" + "".join("<li>%s</li>" % inline(x) for x in block) + "</ol>")
            continue

        block = []
        while (i < n and lines[i].strip()
               and not re.match(r"^(#{1,4}\s|\||>|---+$)", lines[i].strip())
               and not lines[i].strip().startswith(BT * 3)
               and not re.match(r"^\s*([-*]|\d+\.)\s+", lines[i])):
            block.append(lines[i].strip())
            i += 1
        out.append("<p>%s</p>" % inline(" ".join(block)))
    return "\n".join(out)


TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>作文批改器 · 使用说明书</title>
<link rel="icon" href="assets/icons/favicon.svg">
<style>
:root{--blue:#2f7cf6;--bg:#f2f4f8;--card:#fff;--text:#16202e;--muted:#6b7383;--line:#e6e9f0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);overflow-x:hidden;color:var(--text);font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
.top{position:sticky;top:0;z-index:9;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:rgba(255,255,255,.86);backdrop-filter:saturate(180%) blur(18px);border-bottom:1px solid var(--line)}
.top b{font-size:15px;letter-spacing:.2px}
.top a{font-size:13px;color:var(--blue);text-decoration:none;font-weight:600;border:0}
.wrap{max-width:760px;margin:0 auto;padding:18px 16px 64px;overflow-x:clip}
article{background:var(--card);border-radius:22px;padding:22px 20px;box-shadow:0 10px 30px rgba(22,32,46,.06)}
h1{font-size:26px;line-height:1.3;margin:.2em 0 .5em}
h2{font-size:20px;margin:1.6em 0 .6em;padding-top:.6em;border-top:1px solid var(--line)}
h3{font-size:17px;margin:1.3em 0 .5em;color:#20304a}
p{margin:.7em 0}
blockquote{margin:14px 0;padding:12px 16px;background:#eef4ff;border-left:3px solid var(--blue);border-radius:0 12px 12px 0;color:#2a3a55}
img{display:block;width:100%;max-width:420px;height:auto;margin:14px auto;border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 22px rgba(22,32,46,.08)}
ul,ol{margin:.6em 0;padding-left:1.3em}
li{margin:.3em 0}
hr{border:0;border-top:1px solid var(--line);margin:28px 0}
code{background:#f2f4f8;border-radius:6px;padding:1px 5px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre.code{background:#0f172a;max-width:100%;color:#dbe4f5;border-radius:14px;padding:14px 16px;overflow:auto;font-size:13px;line-height:1.6}
pre.code code{background:none;padding:0;color:inherit}
.table-wrap{overflow-x:auto;margin:14px 0}
table{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}
th{background:#f7f9fc;font-weight:600}
a{color:var(--blue);text-decoration:none;border-bottom:1px solid rgba(47,124,246,.3);overflow-wrap:anywhere}
.foot{margin-top:18px;text-align:center;color:var(--muted);font-size:12px}
.foot a{color:var(--muted)}
@media (max-width:520px){article{padding:18px 15px;border-radius:18px}h1{font-size:22px}h2{font-size:18px}}
</style>
</head>
<body>
<div class="top"><b>作文批改器 · 说明书</b><a href="./">打开应用 →</a></div>
<div class="wrap">
<article>
__CONTENT__
</article>
<div class="foot"><a href="./">返回应用</a> · <a href="https://github.com/LuLu3103/composition-correct" target="_blank" rel="noopener">GitHub 仓库</a> · V6.0</div>
</div>
</body>
</html>
"""


def main():
    md = open(SRC, encoding="utf-8").read()
    # README 里给 GitHub 读者看的「图片看不到」提示，说明书内不需要
    md = "\n".join(ln for ln in md.split("\n") if not ln.startswith("> **图片看不到"))
    page = TEMPLATE.replace("__CONTENT__", convert(md))
    open(OUT, "w", encoding="utf-8", newline="\n").write(page)
    print("wrote", OUT, len(page), "bytes")


if __name__ == "__main__":
    main()
