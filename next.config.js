const withPWA = require("next-pwa");
const runtimeCaching = require("next-pwa/cache");
const path = require("path")

const configWithPWA = withPWA({
  pwa: {
    dest: "public",
    runtimeCaching,
  },
});

const config = {
  ...configWithPWA,
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // // Needed when library is linked via `npm link` to app
    config.resolve.alias.react = path.resolve("./node_modules/react")
    return config
  }
};

module.exports = config;
