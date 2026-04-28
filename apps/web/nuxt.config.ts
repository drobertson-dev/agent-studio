import tailwindcss from "@tailwindcss/vite";
const isTestEnv = process.env.NODE_ENV === "test";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: {
    enabled: false,

    timeline: {
      enabled: true,
    },
  },
  ssr: false,
  app: {
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
    head: {
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
      ],
    },
  },
  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@vueuse/nuxt",
    "@nuxtjs/color-mode",
    "nuxt-shiki",
    "@nuxt/test-utils/module",
    "motion-v/nuxt",
    "@formkit/auto-animate/nuxt",
    "@nuxtjs/mdc",
    "shadcn-nuxt",
  ],
  colorMode: {
    preference: "dark",
    fallback: "dark",
    classSuffix: "",
  },
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: "@/components/ui",
  },
  css: ["~/assets/css/tailwind.css"],
  fonts: {
    providers: isTestEnv
      ? {
          google: false,
          googleicons: false,
          bunny: false,
          fontshare: false,
          fontsource: false,
        }
      : undefined,
  },
  icon: {
    mode: "svg",
    class: "as-icon",
  },
  runtimeConfig: {
    LANGGRAPH_API_URL: process.env.LANGGRAPH_API_URL,
    LANGGRAPH_API_KEY: process.env.LANGGRAPH_API_KEY,
    STUDIO_PASSWORD: process.env.STUDIO_PASSWORD,
    AUTH_SECRET: process.env.AUTH_SECRET,
  },
  experimental: {
    asyncContext: true,
  },
  build: {
    transpile: ["camelcase"],
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
    experimental: {
      websocket: true,
      asyncContext: true,
    },
  },
  vite: {
    optimizeDeps: {
      include: ["camelcase", "langchain", "@langchain/core", "@langchain/langgraph", "@langchain/langgraph-sdk"],
    },
    plugins: [tailwindcss()],
  },
});
