import { readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../product-landings/_images/', import.meta.url));
const destination = fileURLToPath(new URL('../public/_images/', import.meta.url));
// Generated mirror only: canonical images and creative sidecars live together.
await rm(destination, { recursive: true, force: true });
async function copyImages(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = join(relative, entry.name);
    if (entry.isDirectory()) await copyImages(join(directory, entry.name), name);
    else if (entry.isFile() && /\.(?:png|jpe?g|svg|webp|avif)$/i.test(entry.name)) {
      await mkdir(join(destination, relative), { recursive: true });
      await copyFile(join(source, name), join(destination, name));
    }
  }
}
await copyImages(source);
