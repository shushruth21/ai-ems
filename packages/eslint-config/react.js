import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

import base from "./base.js";

/** React component libraries. */
export default defineConfig([...base, reactHooks.configs.flat.recommended]);
