// Staged uploads: local image → Shopify's temporary upload storage → a `resourceUrl`
// that can be used as `originalSource` in productSet `files` (or fileCreate).
//
//   1. stagedUploadsCreate(input: [{ filename, mimeType, resource: IMAGE, httpMethod: POST, fileSize }])
//      → stagedTargets[{ url, resourceUrl, parameters[{ name, value }] }]
//   2. multipart/form-data POST to `url`: every parameter as a form field, then the file
//      itself as the LAST field named "file" (the storage backend requires that order).
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

/** { file, filename, mimeType, size } for a local file (throws if it doesn't exist). */
export function describeFile(file) {
  const { size } = fs.statSync(file);
  const filename = path.basename(file);
  return { file, filename, mimeType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', size };
}

/** Variables for stagedUploadsCreate (exported so --dry-run can print exactly what would be sent). */
export function stagedUploadVariables(files) {
  return {
    input: files.map(describeFile).map((f) => ({
      filename: f.filename,
      mimeType: f.mimeType,
      resource: 'IMAGE',
      httpMethod: 'POST',
      fileSize: String(f.size),
    })),
  };
}

async function postWithRetry(url, makeForm, label, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', body: makeForm() });
      if (res.ok) return;
      const detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 300);
      if (res.status < 500 || attempt >= attempts) throw new Error(`upload of ${label} failed: HTTP ${res.status} ${detail}`);
    } catch (err) {
      if (attempt >= attempts || /^upload of/.test(err.message)) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

/**
 * Uploads local images and returns a Map(filename → resourceUrl).
 * @param {{ request: Function }} api  Admin client (see client.mjs)
 * @param {string[]} files             absolute paths
 */
export async function stageImages(api, files) {
  const result = new Map();
  if (!files.length) return result;
  const infos = files.map(describeFile);

  const data = await api.request(STAGED_UPLOADS_CREATE, stagedUploadVariables(files));
  const { stagedTargets, userErrors } = data.stagedUploadsCreate;
  if (userErrors?.length) throw new Error(`stagedUploadsCreate: ${userErrors.map((e) => e.message).join('; ')}`);
  if (!stagedTargets || stagedTargets.length !== infos.length) throw new Error('stagedUploadsCreate returned an unexpected number of targets');

  for (const [i, target] of stagedTargets.entries()) {
    const info = infos[i];
    const bytes = fs.readFileSync(info.file);
    await postWithRetry(
      target.url,
      () => {
        const form = new FormData();
        for (const { name, value } of target.parameters) form.append(name, value);
        form.append('file', new Blob([bytes], { type: info.mimeType }), info.filename);
        return form;
      },
      info.filename,
    );
    result.set(info.filename, target.resourceUrl);
  }
  return result;
}
