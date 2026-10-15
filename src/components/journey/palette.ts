// Journey palettes — static, three-free. Worlds follow the page theme live.

export type ThemeMode = "light" | "dark";

export type JourneyPalette = {
  sky: string;
  ground: string;
  road: string;
  hills: string;
  dash: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  rimColor: string;
  rimIntensity: number;
  glassTint: string;
};

export const JOURNEY_PALETTES: Record<ThemeMode, JourneyPalette> = {
  dark: {
    sky: "#141a2e",
    ground: "#20263a",
    road: "#2b3049",
    hills: "#252c44",
    dash: "#8a6a2f",
    hemiSky: "#ffe3c0",
    hemiGround: "#241d33",
    hemiIntensity: 0.85,
    sunColor: "#ffd9a8",
    sunIntensity: 1.5,
    rimColor: "#f7931a",
    rimIntensity: 40,
    glassTint: "#cfe4ff",
  },
  light: {
    sky: "#e9edf5",
    ground: "#d8d1bf",
    road: "#b3ac97",
    hills: "#a3acc2",
    dash: "#8a6a2f",
    hemiSky: "#ffffff",
    hemiGround: "#b0a58c",
    hemiIntensity: 1.0,
    sunColor: "#fff1dc",
    sunIntensity: 1.6,
    rimColor: "#f7931a",
    rimIntensity: 30,
    glassTint: "#ffffff",
  },
};
