import type { ModuleManifest } from "@emoji/ui";
import { manifest as emojiTranslator } from "@emoji/module-emoji-translator";

/**
 * The single source of truth for every module in the suite.
 *
 * To add a new module: create a package under packages/modules/, export a
 * ModuleManifest, and append it here. The landing page and router pick it up
 * automatically — no other shell changes required.
 */
export const MODULES: ModuleManifest[] = [emojiTranslator];
