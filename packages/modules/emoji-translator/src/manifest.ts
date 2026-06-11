import type { ModuleManifest } from "@scroll-goblin/ui";

export const manifest: ModuleManifest = {
  id: "emoji-translator",
  title: "Emoji Translator",
  description:
    "Translate between human language and emoji in both directions, powered by an LLM.",
  emoji: "😀",
  path: "/apps/emoji-translator",
  status: "active",
  load: () => import("./EmojiTranslatorPage"),
};
