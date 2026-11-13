"""Verify source-only distribution bytes without installing or running the product."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'SOURCE-MANIFEST.json').read_text())
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
files = {name for name in files if name}
assert files - {'SOURCE-MANIFEST.json'} == set(manifest['files']), 'source inventory differs'
size = 0
for name in sorted(files):
    path = root / name
    assert path.is_file() and not path.is_symlink(), f'not a regular source file: {name}'
    assert not name.startswith(('.gitea/', 'deploy/', 'node_modules/', 'dist/', 'public/_images/')), name
    data = path.read_bytes()
    size += len(data)
    assert len(data) <= 10 * 1024 * 1024, f'oversize file: {name}'
    if name != 'SOURCE-MANIFEST.json':
        assert manifest['files'][name] == {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}, f'source hash differs: {name}'
assert size <= 100 * 1024 * 1024, 'source tree exceeds Fleet size limit'
sdk = json.loads((root / 'licenses/W_ID_BROWSER_SOURCE.json').read_text())
lock = json.loads((root / 'package-lock.json').read_text())
package = json.loads((root / 'package.json').read_text())
assert package['dependencies']['@w-id/browser'] == sdk['resolved'], 'SDK dependency pin differs'
entry = lock['packages']['node_modules/@w-id/browser']
assert all(entry[key] == sdk[key] for key in ['version', 'resolved', 'integrity']), 'SDK lock provenance differs'
images = [name for name in files if name.startswith('product-landings/_images/') and name.endswith(('.png', '.jpg'))]
assert len(images) == 173, 'original promotional image set differs'
assert all((root / name.replace('.png', '.prompt.md').replace('.jpg', '.prompt.md')).is_file() for name in images), 'creative sidecar missing'
print(f'Public source verified: {len(files)} files, {size} bytes, 173 canonical images; original SDK package pin matches.')
