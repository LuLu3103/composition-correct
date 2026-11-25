#!/usr/bin/env python3
"""用 GitHub API 提交并发布（git push 网络不通时使用）。"""
import base64, hashlib, json, os, subprocess, sys, time

REPO = os.environ.get("DEPLOY_REPO", "LuLu3103/composition-correct")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "shots", "node_modules", "__pycache__"}
SKIP_FILES = {"提示词.txt"}
TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".webmanifest", ".svg", ".md", ".txt", ".yml", ".yaml"}

def gh(args, payload=None):
    proc = subprocess.run(["gh", "api"] + args, input=payload, capture_output=True, text=True, encoding="utf-8")
    return proc

def collect_files():
    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            if rel in SKIP_FILES:
                continue
            if name.startswith(".") and name not in {".nojekyll", ".gitignore"}:
                continue
            files.append(rel)
    files.sort()
    return files

BLOB_CACHE = {}

def make_blob(data):
    """二进制文件必须走 /git/blobs 建 blob：trees 接口的 content 只按 utf-8 文本处理，写 base64 会把文件写坏。"""
    key = hashlib.sha1(data).hexdigest()
    if key in BLOB_CACHE:
        return BLOB_CACHE[key]
    payload = json.dumps({"content": base64.b64encode(data).decode("ascii"), "encoding": "base64"})
    res = gh(["repos/%s/git/blobs" % REPO, "--input", "-"], payload)
    if res.returncode != 0:
        raise RuntimeError("create blob failed for %s: %s" % (key, res.stderr[:300]))
    sha = json.loads(res.stdout)["sha"]
    BLOB_CACHE[key] = sha
    return sha

def entry_for(rel):
    data = open(os.path.join(ROOT, rel), "rb").read()
    ext = os.path.splitext(rel)[1].lower()
    if ext in TEXT_EXT or rel in {".nojekyll", ".gitignore"}:
        try:
            return {"path": rel, "mode": "100644", "type": "blob", "content": data.decode("utf-8")}
        except UnicodeDecodeError:
            pass
    return {"path": rel, "mode": "100644", "type": "blob", "sha": make_blob(data)}

def main():
    files = collect_files()
    print("files:", len(files))
    for f in files:
        print("  -", f)
    if "--dry-run" in sys.argv:
        return 0
    parent = None
    ref = gh(["repos/%s/git/ref/heads/main" % REPO])
    if ref.returncode == 0:
        parent = json.loads(ref.stdout)["object"]["sha"]
        print("parent:", parent)
    else:
        print("empty repo, bootstrapping README ...")
        boot = {
            "message": "chore: bootstrap repository",
            "content": base64.b64encode(open(os.path.join(ROOT, "README.md"), "rb").read()).decode("ascii"),
        }
        res = gh(["repos/%s/contents/README.md" % REPO, "-X", "PUT", "--input", "-"], json.dumps(boot))
        if res.returncode != 0:
            print("bootstrap failed:", res.stderr[:600])
            return 1
        ref = gh(["repos/%s/git/ref/heads/main" % REPO])
        parent = json.loads(ref.stdout)["object"]["sha"]
        print("parent:", parent)

    entries = [entry_for(f) for f in files]
    res = gh(["repos/%s/git/trees" % REPO, "--input", "-"], json.dumps({"tree": entries}))
    if res.returncode != 0:
        print("create tree failed:", res.stderr[:800]); return 1
    tree_sha = json.loads(res.stdout)["sha"]
    print("tree:", tree_sha)
    msg = "feat: 考研作文批改器 V1.0.0"
    commit = {"message": msg, "tree": tree_sha}
    if parent:
        commit["parents"] = [parent]
    res = gh(["repos/%s/git/commits" % REPO, "--input", "-"], json.dumps(commit))
    if res.returncode != 0:
        print("create commit failed:", res.stderr[:800]); return 1
    sha = json.loads(res.stdout)["sha"]
    print("commit:", sha)
    if parent:
        res = gh(["repos/%s/git/refs/heads/main" % REPO, "-X", "PATCH", "--input", "-"], json.dumps({"sha": sha, "force": True}))
    else:
        res = gh(["repos/%s/git/refs" % REPO, "--input", "-"], json.dumps({"ref": "refs/heads/main", "sha": sha}))
    if res.returncode != 0:
        print("update ref failed:", res.stderr[:800]); return 1
    print("ref updated")
    res = gh(["repos/%s/pages" % REPO, "--input", "-"], json.dumps({"source": {"branch": "main", "path": "/"}}))
    print("pages:", (res.stdout or res.stderr or "").strip()[:200])
    gh(["repos/%s/pages/builds" % REPO, "-X", "POST"])
    for _ in range(60):
        time.sleep(5)
        r = gh(["repos/%s/pages/builds/latest" % REPO])
        if r.returncode != 0:
            continue
        info = json.loads(r.stdout)
        status = info.get("status")
        print("build:", status)
        if status == "built":
            print("url:", info.get("url") or "https://lulu3103.github.io/composition-correct/")
            return 0
        if status == "errored":
            print("build error:", json.dumps(info)[:600]); return 1
    print("build timeout"); return 1

if __name__ == "__main__":
    sys.exit(main())
