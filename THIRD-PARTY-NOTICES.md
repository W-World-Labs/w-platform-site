# Third-party notices

## W-ID browser SDK

The actual original PUBLIC CI npm package @w-id/browser 1.3.60 is fetched from
W-World-Labs/w-id-sdk's browser-v1.3.60 release under MIT. It was built at public
commit 8d57e08c63ad8567dae79c261a0fcad44f1a81a3 in run 43486083662,
artifact 14067745815. The 32,845-byte nine-member TGZ is unchanged, SHA256
8b68e1a12e7667618c4f2cc6354435de541e3fbd53ef4d6ca6ec9e7edbdf4124.
The original MIT text is retained at licenses/W_ID_BROWSER_LICENSE.txt and the
exact URL/SHA512/source receipt at licenses/W_ID_BROWSER_SOURCE.json. Actual
consumer APIs/fields were checked against that package's declarations. No
client implementation, shim, alternate generated types or SDK bundle is copied
into this source distribution; original application calls remain unchanged.

## create-vite template

public/favicon.svg is derived from the Vite template icon. The template and
files generated from it are CC0-1.0 in the upstream create-vite license;
create-vite itself is MIT. The upstream MIT and CC0 sections are preserved verbatim at
licenses/CREATE_VITE_LICENSE.txt, from public Vite commit
b6c20f6a8126d8561891e5fb9368e8fc9da37538 (v8.3.4),
packages/create-vite/LICENSE. CLI bundled-dependency notices are not included
because no create-vite CLI or bundled code is vendored. This does not grant
Vite trademark rights.
The unused starter hero, React/Vite art and social sprite are omitted.

## npm and optional image tooling

package-lock.json records exact public npm versions, integrity and declared
licenses for the installed dependency graph. They retain their respective
licenses; no node_modules, compiled dependency bundle or browser is included in
the source artifact. A separately distributed website must collect the actual
bundle's required notices. The optional local image-derivation utility imports
Pillow; Pillow is not vendored or part of the public CI install. Its independent
license applies when the operator installs it.

W product names, external documentation links and services identify integrations
only. They and their trademarks are not relicensed by root MIT. The promotional
art provenance and limitations are described in PUBLIC_SOURCE.md and retained
creative sidecars; these are project-generated illustrations, not live data.
