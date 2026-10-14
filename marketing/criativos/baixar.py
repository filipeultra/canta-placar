# Baixa os arquivos do Magnific para src/: python3 marketing/criativos/baixar.py links.json
# links.json = {"src/img/a1-briga.png": "<url de creations_get>", ...} (links temporários; não guardar no git)
import json, os, sys, urllib.request
base = os.path.dirname(os.path.abspath(__file__))
links = json.load(open(sys.argv[1]))
for rel, url in links.items():
    dst = os.path.join(base, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst) and os.path.getsize(dst) > 0: continue
    with urllib.request.urlopen(url, timeout=60) as r, open(dst, 'wb') as f: f.write(r.read())
    print('ok', rel, os.path.getsize(dst))
