import { useEffect, useState } from "react";

type LogoColors = {
  backgroundColor: string;
  foregroundColor: string;
};

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

type ColorBucket = RgbColor & {
  count: number;
};

const colorCache = new Map<string, LogoColors | null>();
const pendingExtractions = new Map<string, Promise<LogoColors | null>>();
const logoColorAlgorithmVersion = "pixel-histogram-v4";
const neutralLogoColors: LogoColors = {
  backgroundColor: "var(--financial-summary-neutral)",
  foregroundColor: "var(--financial-summary-neutral-foreground)",
};

export function useLogoColors(src?: string | null) {
  const cacheKey = src ? `${logoColorAlgorithmVersion}:${src}` : null;
  const [colors, setColors] = useState<LogoColors | null>(() =>
    cacheKey && colorCache.has(cacheKey) ? (colorCache.get(cacheKey) ?? null) : null,
  );

  useEffect(() => {
    let isCurrent = true;

    if (!src || !cacheKey) {
      setColors(null);
      return () => {
        isCurrent = false;
      };
    }

    if (colorCache.has(cacheKey)) {
      setColors(colorCache.get(cacheKey) ?? null);
      return () => {
        isCurrent = false;
      };
    }

    setColors(null);
    void extractLogoColors(src, cacheKey).then((nextColors) => {
      if (isCurrent) setColors(nextColors);
    });

    return () => {
      isCurrent = false;
    };
  }, [cacheKey, src]);

  return colors;
}

function extractLogoColors(src: string, cacheKey: string) {
  const pending = pendingExtractions.get(cacheKey);
  if (pending) return pending;

  const extraction = loadLogoImage(src)
    .then((image) => getDominantLogoColor(image))
    .then((color) => (color ? toAccessibleLogoColors(rgbToOklch(color)) : neutralLogoColors))
    .catch(() => null)
    .then((colors) => {
      colorCache.set(cacheKey, colors);
      pendingExtractions.delete(cacheKey);
      return colors;
    });

  pendingExtractions.set(cacheKey, extraction);
  return extraction;
}

function getDominantLogoColor(image: HTMLImageElement): RgbColor | null {
  const maximumDimension = 64;
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const buckets = new Map<number, ColorBucket>();

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const alpha = pixels[offset + 3];
    if (alpha < 128 || isNearlyWhite(red, green, blue) || !isSaturated(red, green, blue)) continue;

    const key = (red >> 5) * 64 + (green >> 5) * 8 + (blue >> 5);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      bucket.count += 1;
    } else {
      buckets.set(key, { blue, count: 1, green, red });
    }
  }

  const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0];
  if (!dominant) return null;

  return {
    blue: Math.round(dominant.blue / dominant.count),
    green: Math.round(dominant.green / dominant.count),
    red: Math.round(dominant.red / dominant.count),
  };
}

function isNearlyWhite(red: number, green: number, blue: number) {
  return red > 245 && green > 245 && blue > 245;
}

function isSaturated(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return maximum > 0 && (maximum - minimum) / maximum >= 0.08;
}

function rgbToOklch({ blue, green, red }: RgbColor) {
  const linearRed = srgbChannelToLinear(red);
  const linearGreen = srgbChannelToLinear(green);
  const linearBlue = srgbChannelToLinear(blue);
  const l = Math.cbrt(
    0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue,
  );
  const m = Math.cbrt(
    0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue,
  );
  const s = Math.cbrt(
    0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue,
  );
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(b, a) * 180) / Math.PI;

  return {
    c: Math.sqrt(a ** 2 + b ** 2),
    h: hue < 0 ? hue + 360 : hue,
    l: lightness,
  };
}

function toAccessibleLogoColors({ c, h, l }: { c: number; h: number; l: number }): LogoColors {
  const minimumLightness = 0.48;
  const maximumLightness = 0.78;
  const lightness = Math.min(maximumLightness, Math.max(minimumLightness, l));
  const { blue, green, red } = oklchToSrgb(lightness, c, Number.isFinite(h) ? h : 0);
  const luminance = relativeLuminance(red, green, blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return {
    backgroundColor: `rgb(${red} ${green} ${blue})`,
    foregroundColor: whiteContrast >= blackContrast ? "#ffffff" : "#0a0a0a",
  };
}

function oklchToSrgb(lightness: number, chroma: number, hue: number) {
  const hueInRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueInRadians);
  const b = chroma * Math.sin(hueInRadians);
  const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s = lightness - 0.0894841775 * a - 1.291485548 * b;
  const linearRed = 4.0767416621 * l ** 3 - 3.3077115913 * m ** 3 + 0.2309699292 * s ** 3;
  const linearGreen = -1.2684380046 * l ** 3 + 2.6097574011 * m ** 3 - 0.3413193965 * s ** 3;
  const linearBlue = -0.0041960863 * l ** 3 - 0.7034186147 * m ** 3 + 1.707614701 * s ** 3;

  return {
    blue: linearChannelToSrgb(linearBlue),
    green: linearChannelToSrgb(linearGreen),
    red: linearChannelToSrgb(linearRed),
  };
}

function linearChannelToSrgb(channel: number) {
  const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

function srgbChannelToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(red: number, green: number, blue: number) {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function loadLogoImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
