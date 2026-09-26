import { saveAs } from 'file-saver';

/**
 * Resolve the DOM root from an AccessibleInfographic imperative handle or a raw element.
 * @param {object|HTMLElement|null|undefined} handleOrEl
 * @returns {HTMLElement|null}
 */
export function resolveAccessibleInfographicRoot(handleOrEl) {
  if (!handleOrEl) return null;
  if (typeof handleOrEl.getRootElement === 'function') return handleOrEl.getRootElement();
  return handleOrEl;
}

/**
 * Resolve the graphic <img>/<svg> from an AccessibleInfographic handle or a raw element.
 * @param {object|HTMLElement|null|undefined} handleOrEl
 * @returns {HTMLElement|null}
 */
export function resolveAccessibleInfographicGraphic(handleOrEl) {
  if (!handleOrEl) return null;
  if (typeof handleOrEl.getGraphicElement === 'function') return handleOrEl.getGraphicElement();
  return handleOrEl;
}

/**
 * Wait until an <img> has decoded dimensions.
 * @param {HTMLImageElement} img
 */
export function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (!img) {
      reject(new Error('No image element'));
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
      return;
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

/**
 * Rasterize an image element to a canvas (scaled).
 * @param {HTMLImageElement|null} imgEl
 * @param {{ scale?: number }} [options]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function imageElementToCanvas(imgEl, { scale = 2 } = {}) {
  if (!imgEl) return null;
  const loaded = await waitForImage(imgEl);
  const canvas = document.createElement('canvas');
  canvas.width = loaded.naturalWidth * scale;
  canvas.height = loaded.naturalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
  return canvas;
}

/**
 * Rasterize an inline <svg> element to a canvas via blob URL.
 * @param {SVGSVGElement|null} svgEl
 * @param {{ scale?: number }} [options]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function svgElementToCanvas(svgEl, { scale = 2 } = {}) {
  if (!svgEl) return null;
  const clone = svgEl.cloneNode(true);
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  const vb = svgEl.viewBox?.baseVal;
  const width = svgEl.width?.baseVal?.value || vb?.width || svgEl.clientWidth || 1;
  const height = svgEl.height?.baseVal?.value || vb?.height || svgEl.clientHeight || 1;
  if (!clone.getAttribute('width')) clone.setAttribute('width', String(width));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(height));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    const loaded = await new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = (loaded.naturalWidth || width) * scale;
    canvas.height = (loaded.naturalHeight || height) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(loaded, 0, 0, loaded.naturalWidth || width, loaded.naturalHeight || height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download an infographic <img> or inline <svg> as PNG.
 * @param {HTMLImageElement|SVGSVGElement|HTMLElement|null} el
 * @param {{ filename: string, scale?: number }} options
 */
export async function downloadInfographicImagePng(el, { filename, scale = 2 } = {}) {
  if (!el) return;
  let canvas = null;
  if (el instanceof HTMLImageElement) {
    canvas = await imageElementToCanvas(el, { scale });
  } else if (el instanceof SVGSVGElement) {
    canvas = await svgElementToCanvas(el, { scale });
  } else if (el.querySelector) {
    const svg = el.querySelector('svg');
    const img = el.querySelector('img');
    if (svg) canvas = await svgElementToCanvas(svg, { scale });
    else if (img) canvas = await imageElementToCanvas(img, { scale });
  }
  if (!canvas) return;
  const name = filename?.endsWith('.png') ? filename : `${filename || 'infographic'}.png`;
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, name);
      resolve();
    });
  });
}
