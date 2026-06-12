import type { ModuleManifest } from "@scroll-goblin/ui";
import { manifest as emojiTranslator } from "@scroll-goblin/module-emoji-translator";
import { manifest as touchGrass } from "@scroll-goblin/module-touch-grass";
import { manifest as screamingChicken } from "@scroll-goblin/module-screaming-chicken";
import { manifest as communeWithGod } from "@scroll-goblin/module-commune-with-god";
import { manifest as potatoPainter } from "@scroll-goblin/module-potato-painter";
import { manifest as slugFencing } from "@scroll-goblin/module-slug-fencing";
import { manifest as balloonBlower } from "@scroll-goblin/module-balloon-blower";

/**
 * The single source of truth for every module in the suite.
 *
 * To add a new module: create a package under packages/modules/, export a
 * ModuleManifest, and append it here. The landing page and router pick it up
 * automatically — no other shell changes required.
 */
export const MODULES: ModuleManifest[] = [
  emojiTranslator,
  touchGrass,
  screamingChicken,
  communeWithGod,
  potatoPainter,
  slugFencing,
  balloonBlower,
];
