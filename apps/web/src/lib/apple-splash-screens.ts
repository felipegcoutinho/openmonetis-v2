/**
 * Launch images for the installed app on iPhone. iOS ignores the manifest background colour and
 * shows a white screen while the app starts unless an image matches the exact screen. Files live
 * in `public/images/splash`, one per screen and theme.
 */
const screens: ReadonlyArray<readonly [width: number, height: number, ratio: number]> = [
  [375, 667, 2],
  [414, 896, 2],
  [375, 812, 3],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
];

export const appleSplashScreenLinks = screens.flatMap(([width, height, ratio]) =>
  (["light", "dark"] as const).map((theme) => ({
    rel: "apple-touch-startup-image",
    href: `/images/splash/splash-${width * ratio}x${height * ratio}-${theme}.png`,
    media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
  })),
);
