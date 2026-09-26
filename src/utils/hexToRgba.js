/**
 * Convert #RRGGBB (optional leading #) to rgba() with opacity.
 * Returns the original hex string if parsing fails.
 */
export default function hexToRgba(hex, opacity = 1) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
  }
  return hex;
}
