const withPWA = require("next-pwa");
const runtimeCaching = require("next-pwa/cache");

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
};

module.exports = config;
