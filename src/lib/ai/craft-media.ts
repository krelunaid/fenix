/** Screenshot of Fenix phone UI that shipped as /craft-hero.jpg in 5ef46dc. */
export const BANNED_CRAFT_SHA256 = [
  "192e6400aa6709b3768fb05ff375ea3b8d28ef3a1a1a56ecf18dd6aacdf0cf0a",
];

export const CRAFT_HERO_FILE = "craft-hero.jpg";
export const CRAFT_GALLERY_FILES = [
  "craft-shelf.jpg",
  "craft-vase.jpg",
  "craft-bowl.jpg",
  "craft-plate.jpg",
  "craft-pitcher.jpg",
] as const;

export const CRAFT_PHOTO_FILES = [CRAFT_HERO_FILE, ...CRAFT_GALLERY_FILES] as const;
