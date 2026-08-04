// SPDX-License-Identifier: Apache-2.0
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "imageman-cloud",
                "imageman-cloud/**",
                "**/imageman-cloud/**",
                "imageman-whitelabel",
                "imageman-whitelabel/**",
                "**/imageman-whitelabel/**",
                "imageman-enterprise",
                "imageman-enterprise/**",
                "**/imageman-enterprise/**",
                "overlays/**",
                "**/overlays/**",
              ],
              message:
                "Public-core code must not import private cloud, white-label, enterprise, or overlay modules.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
