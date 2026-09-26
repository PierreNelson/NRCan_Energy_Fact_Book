/**
 * Download a Plotly chart as PNG, optionally compositing title/subtitle/legend.
 */
import { saveAs } from 'file-saver';

/**
 * Resolve a Plotly graph div from a modebar click target or a chart host ref.
 */
export function resolvePlotElement(plotEl, chartRef) {
  if (plotEl?.classList?.contains('js-plotly-plot')) return plotEl;
  if (plotEl?.querySelector) {
    const inner = plotEl.querySelector('.js-plotly-plot');
    if (inner) return inner;
  }
  return chartRef?.current?.querySelector?.('.js-plotly-plot') || plotEl || null;
}

/**
 * @deprecated Prefer useChartPngDownloader (hook) — plain factory trips react-hooks/refs lint.
 * Kept for non-component callers; pass a host element getter and only call the result on click.
 */
export function makeChartPngDownloader(getHostEl, optionsOrFactory) {
  return (plotEl = null) => {
    const host = typeof getHostEl === 'function' ? getHostEl() : getHostEl?.current;
    const plotElement = resolvePlotElement(plotEl, { current: host ?? null });
    const options = typeof optionsOrFactory === 'function'
      ? optionsOrFactory(plotElement)
      : optionsOrFactory;
    return downloadChartPng(plotElement, options);
  };
}

/**
 * @param {HTMLElement|null} plotElement - `.js-plotly-plot` node or graph div
 * @param {object} options
 */
export async function downloadChartPng(plotElement, options = {}) {
  const {
    filename = 'chart.png',
    title = '',
    subtitle = '',
    legendItems = [],
    width = 1200,
    height = 600,
    scale = 2,
  } = options;

  if (!plotElement || typeof window === 'undefined' || !window.Plotly) return;

  const imgData = await window.Plotly.toImage(plotElement, {
    format: 'png',
    width,
    height,
    scale,
  });

  const needsComposite = Boolean(title || subtitle || legendItems.length);
  if (!needsComposite) {
    const res = await fetch(imgData);
    const blob = await res.blob();
    saveAs(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
    return;
  }

  await new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        const titleHeight = title || subtitle ? 110 : 0;
        const legendHeight = legendItems.length ? 60 : 0;
        canvas.width = img.width;
        canvas.height = img.height + titleHeight + legendHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (title) {
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 36px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(title, canvas.width / 2, 45);
        }
        if (subtitle) {
          ctx.fillStyle = '#333333';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(subtitle, canvas.width / 2, title ? 80 : 45);
        }

        ctx.drawImage(img, 0, titleHeight);

        if (legendItems.length) {
          const legendY = titleHeight + img.height + 30;
          const totalWidth = legendItems.reduce(
            (acc, item) => acc + ctx.measureText(item.label).width + 60,
            0,
          );
          let xPos = (canvas.width - totalWidth) / 2;
          legendItems.forEach((item) => {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 3;
            ctx.setLineDash(item.dash ? [8, 4] : []);
            ctx.beginPath();
            ctx.moveTo(xPos, legendY);
            ctx.lineTo(xPos + 30, legendY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#333333';
            ctx.font = '24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, xPos + 40, legendY + 8);
            xPos += ctx.measureText(item.label).width + 80;
          });
        }

        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
          }
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = imgData;
  });
}
