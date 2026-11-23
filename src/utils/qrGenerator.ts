import QRCode from 'qrcode';

export interface QROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generate a PNG Data URL for a given Live Label code
 */
export async function generateLiveLabelQRDataUrl(
  code: string,
  origin = window.location.origin,
  options: QROptions = {}
): Promise<string> {
  const url = `${origin}/live?code=${encodeURIComponent(code)}`;
  return QRCode.toDataURL(url, {
    width: options.width || 512,
    margin: options.margin || 2,
    color: {
      dark: options.color?.dark || '#1c1917', // stone-900
      light: options.color?.light || '#fcfbf9'  // warm paper white
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Generate an SVG string for scalable vector printing
 */
export async function generateLiveLabelQRSvg(
  code: string,
  origin = window.location.origin,
  options: QROptions = {}
): Promise<string> {
  const url = `${origin}/live?code=${encodeURIComponent(code)}`;
  return QRCode.toString(url, {
    type: 'svg',
    width: options.width || 600,
    margin: options.margin || 2,
    color: {
      dark: options.color?.dark || '#1c1917',
      light: options.color?.light || '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });
}
