/**
 * The web app manifest. Its bar colours follow the appearance on screen: the page links to it as
 * `/manifest.json?theme=<palette>-<mode>`, because the installed app takes its status bar (Firefox)
 * and navigation bar (Chrome) colours from the manifest alone, not from the page.
 */
const webAppManifest = {
  short_name: "OpenMonetis",
  name: "OpenMonetis",
  description:
    "Controle financeiro pessoal: lançamentos, contas, cartões, orçamentos e relatórios.",
  lang: "pt-BR",
  dir: "ltr",
  id: "/",
  scope: "/",
  start_url: "/",
  display: "standalone",
  orientation: "any",
  categories: ["finance", "productivity"],
  launch_handler: {
    client_mode: ["navigate-existing", "auto"],
  },
  icons: [
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Lançamentos",
      short_name: "Lançamentos",
      url: "/transactions",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    {
      name: "Caixa de entrada",
      short_name: "Caixa",
      url: "/inbox",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    {
      name: "Contas",
      short_name: "Contas",
      url: "/accounts",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
  ],
} as const;

export function createWebAppManifest(color: string) {
  return { ...webAppManifest, theme_color: color, background_color: color };
}
