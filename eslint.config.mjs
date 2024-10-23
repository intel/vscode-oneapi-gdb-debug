import globals from "globals";
import tseslint from "typescript-eslint";
import stylisticTs from "@stylistic/eslint-plugin-ts"

export default [
  {
    files: ["src/**/*.ts"],
    plugins: {
      '@stylistic/ts': stylisticTs
    },
    rules: {
      "@stylistic/ts/member-delimiter-style": [
        "error",
        {
          "multiline": {
            "delimiter": "semi",
            "requireLast": true
          },
          "singleline": {
            "delimiter": "semi",
            "requireLast": false
          }
        }
      ],
      "semi": [
        "error",
        "always"
      ],
      "curly": "warn",
      "eqeqeq": [
        "warn",
        "always"
      ],
      "no-redeclare": "warn",
      "no-throw-literal": "warn",
      "no-unused-expressions": "warn",
      "indent": ["error", 4],
      "linebreak-style": ["error", "unix"],
      "quotes": ["error", "double"],
      // "semi": ["error", "always"],
      "no-empty": "warn",
      "no-cond-assign": ["error", "always"],
      "for-direction": "off",
      "newline-after-var": ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "space-before-function-paren": ["error", "never"]
    }
  },
  { languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended,
];