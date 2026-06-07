import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import page60BgEn from '../assets/page60_bg.png';
import page60BgFr from '../assets/page60_bg_fr.png';

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const exportPage60InfographicPng = async (exportRoot, { title, scale = 2 }) => {
    if (!exportRoot) return null;

    const titleEl = exportRoot.querySelector('#page60-title');
    const bulletsEl = exportRoot.querySelector('.page60-bullets');
    const imgEl = exportRoot.querySelector('.page60-bg-image');
    if (!titleEl || !bulletsEl || !imgEl) return null;

    const waitForImage = (img) =>
        new Promise((resolve, reject) => {
            if (img.complete && img.naturalWidth > 0) {
                resolve(img);
                return;
            }
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

    const loaded = await waitForImage(imgEl);
    const rootRect = exportRoot.getBoundingClientRect();
    const canvasW = Math.ceil(exportRoot.clientWidth);
    const canvasH = Math.ceil(
        Math.max(imgEl.getBoundingClientRect().bottom, bulletsEl.getBoundingClientRect().bottom) -
            rootRect.top +
            16,
    );

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    };

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.fillStyle = titleStyle.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, titleBox.x, titleBox.y);

    const drawTextSegment = (node) => {
        const raw = node.textContent ?? '';
        if (!raw.trim()) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = window.getComputedStyle(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const rects = Array.from(range.getClientRects());
        if (rects.length <= 1) {
            const rect = rects[0] ?? range.getBoundingClientRect();
            ctx.fillText(raw, rect.left - rootRect.left, rect.top - rootRect.top);
            return;
        }
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const words = raw.trim().split(/\s+/);
        let wordIndex = 0;
        rects.forEach((rect, rectIndex) => {
            let line = rectIndex === 0 ? leading : '';
            while (wordIndex < words.length) {
                const separator = line && !line.endsWith(' ') ? ' ' : '';
                const candidate = `${line}${separator}${words[wordIndex]}`;
                if (line && ctx.measureText(candidate).width > rect.width + 2) break;
                line = candidate;
                wordIndex += 1;
            }
            if (line) {
                ctx.fillText(line, rect.left - rootRect.left, rect.top - rootRect.top);
            }
        });
    };

    bulletsEl.querySelectorAll('li').forEach((li) => {
        li.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                drawTextSegment(node);
            }
        });
    });

    const imgBox = rel(loaded);
    ctx.drawImage(loaded, imgBox.x, imgBox.y, imgBox.w, imgBox.h);

    return canvas;
};

const Page60 = () => {
    const { lang } = useOutletContext();
    const contentRef = useRef(null);

    const pageTitle = getText('page60_title', lang);
    const bgImage = lang === 'en' ? page60BgEn : page60BgFr;
    const fileSlugBase = getText('page60_download_title', lang).replace(/\s+/g, '_');

    const downloadPng = async () => {
        const canvas = await exportPage60InfographicPng(contentRef.current, {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-60"
            role="main"
            aria-labelledby="page60-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-60 { width: 100%; max-width: 1140px; margin: 0 auto; box-sizing: border-box; }
                .page60-inner { padding: 24px 0 40px 0; box-sizing: border-box; }
                .page60-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #819476;
                    margin: 0 0 20px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }
                .page60-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page60-bullets {
                    margin: 0 0 24px 0;
                    padding-left: 1.2em;
                }
                .page60-bullets li {
                    margin-bottom: 10px;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                }
                .page60-infographic-section { width: 100%; margin-bottom: 0; }
                .page60-infographic-figure { margin: 0; width: 100%; }
                .page60-bg-image {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .page60-download-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 15px;
                }
                .page60-download-btn {
                    padding: 8px 16px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page60-download-btn:hover { background-color: #404040 !important; }
                @media (max-width: 768px) {
                    .page60-title { font-size: 37px; }
                    .page60-bullets li { font-size: 18px; }
                }
            `}</style>

            <div className="page60-inner" ref={contentRef}>
                <h1 id="page60-title" className="page60-title">
                    {pageTitle}
                </h1>

                <ul className="page60-bullets" role="list">
                    <li role="listitem">{getText('page60_bullet1', lang)}</li>
                    <li role="listitem">{getText('page60_bullet2', lang)}</li>
                    <li role="listitem">{getText('page60_bullet3', lang)}</li>
                </ul>

                <div className="page60-infographic-section">
                    <figure className="page60-infographic-figure" aria-label={getText('page60_infographic_aria', lang)}>
                        <img
                            src={bgImage}
                            alt=""
                            className="page60-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">{getText('page60_infographic_aria', lang)}</figcaption>
                    </figure>

                    <div className="page60-download-buttons">
                        <button type="button" className="page60-download-btn" onClick={downloadPng}>
                            {getText('page60_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page60;
