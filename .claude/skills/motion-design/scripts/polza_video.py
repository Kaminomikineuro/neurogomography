#!/usr/bin/env python3
"""polza_video.py — generate a video shot through polza.ai's media API (Kling, Seedance, Veo, Sora, Wan …).

Stdlib only. Flow (per polza docs): POST {base}/media {"model", "input"} → task (pending) → poll GET {base}/media/{id}
→ download the result. Field names differ between polza doc pages, so the request body is printed with --dry-run and
the response is searched generically for a video URL. Verify against https://polza.ai/docs/api-reference/media/create.

Usage:
  POLZA_API_KEY=... python3 polza_video.py --model kling/v3 --prompt "..." [--prompt-file shot.txt]
        [--param duration=5 --param aspect_ratio=16:9 --param mode=pro]   # any input field, JSON-typed values ok
        [--image path-or-url] [--image ...]                                # reference / first-frame images
        [--image-field images] [--out out/gen] [--timeout 900] [--dry-run]
Env: POLZA_API_KEY (required unless --dry-run), POLZA_BASE_URL (default https://polza.ai/api/v1)
The key is read from the environment only; it is never printed.
"""
import argparse, base64, json, mimetypes, os, re, sys, time, urllib.request, urllib.error

def parse_val(v):
    try: return json.loads(v)
    except Exception: return v

def image_ref(p):
    if re.match(r'^https?://', p): return p
    mime = mimetypes.guess_type(p)[0] or 'image/png'
    with open(p, 'rb') as f: return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()

def req(method, url, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=120) as resp: return json.loads(resp.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code} {url}: {e.read().decode(errors="replace")[:800]}')

def find_urls(obj):
    out = []
    if isinstance(obj, dict):
        for v in obj.values(): out += find_urls(v)
    elif isinstance(obj, list):
        for v in obj: out += find_urls(v)
    elif isinstance(obj, str) and re.match(r'^https?://', obj): out.append(obj)
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True)
    ap.add_argument('--prompt'); ap.add_argument('--prompt-file')
    ap.add_argument('--param', action='append', default=[], help='key=value for the input object')
    ap.add_argument('--image', action='append', default=[])
    ap.add_argument('--image-field', default='images')
    ap.add_argument('--out', default='out/gen'); ap.add_argument('--timeout', type=int, default=900)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    prompt = a.prompt or (open(a.prompt_file, encoding='utf-8').read().strip() if a.prompt_file else None)
    if not prompt: sys.exit('need --prompt or --prompt-file')
    inp = {'prompt': prompt}
    for kv in a.param:
        k, _, v = kv.partition('='); inp[k] = parse_val(v)
    if a.image: inp[a.image_field] = [image_ref(p) for p in a.image]
    body = {'model': a.model, 'input': inp}
    base = os.environ.get('POLZA_BASE_URL', 'https://polza.ai/api/v1').rstrip('/')

    if a.dry_run:
        shown = json.loads(json.dumps(body))
        if a.image: shown['input'][a.image_field] = [s[:60] + '…' if len(s) > 60 else s for s in shown['input'][a.image_field]]
        print(f'POST {base}/media'); print(json.dumps(shown, ensure_ascii=False, indent=2)); return

    key = os.environ.get('POLZA_API_KEY')
    if not key: sys.exit('POLZA_API_KEY is not set (add it to the environment; never paste it into commands)')
    task = req('POST', f'{base}/media', key, body)
    tid = task.get('id') or (task.get('data') or {}).get('id')
    if not tid: sys.exit('no task id in response: ' + json.dumps(task, ensure_ascii=False)[:800])
    print(f'task {tid} submitted ({a.model})')
    t0 = time.time(); res = task
    while True:
        st = str(res.get('status') or (res.get('data') or {}).get('status') or '').lower()
        if st in ('completed', 'succeeded', 'success', 'done', 'finished'): break
        if st in ('failed', 'error', 'cancelled', 'canceled'): sys.exit('generation failed: ' + json.dumps(res, ensure_ascii=False)[:800])
        if time.time() - t0 > a.timeout: sys.exit(f'timeout after {a.timeout}s; last status {st!r}; poll later: GET {base}/media/{tid}')
        time.sleep(8); res = req('GET', f'{base}/media/{tid}', key)
        print(f'  status {res.get("status")}  {time.time() - t0:.0f}s')
    urls = [u for u in find_urls(res) if re.search(r'\.(mp4|webm|mov)(\?|$)', u)] or find_urls(res)
    os.makedirs(a.out, exist_ok=True)
    json.dump(res, open(os.path.join(a.out, f'{tid}.json'), 'w'), ensure_ascii=False, indent=2)
    if not urls: sys.exit('completed but no URL found; see ' + os.path.join(a.out, f'{tid}.json'))
    dst = os.path.join(a.out, f'{tid}.mp4')
    urllib.request.urlretrieve(urls[0], dst)
    print(f'→ {dst}')

if __name__ == '__main__':
    main()
