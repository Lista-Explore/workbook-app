const DEFAULTS = {
  primary: "#103049",
  secondary: "#4278ec",
  tertiary: "#b4e000",
  accent: "#df8cbb",
  light: "#ffffff",
  lightBackground: "#cfd6db",
  fontFamily: "DM Sans, sans-serif",
};

function cssValue(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getBranding() {
  const asset = (name) => {
    const version = "20261029-cover-header-footer";
    const urls = [new URL(`../../assets/branding/${name}?v=${version}`, import.meta.url).href];
    if (typeof location !== "undefined") urls.push(new URL(`/assets/branding/${name}?v=${version}`, location.origin).href);
    return urls;
  };
  return {
    primary: cssValue("--color-primary", DEFAULTS.primary),
    secondary: cssValue("--color-secondary", DEFAULTS.secondary),
    tertiary: cssValue("--color-tertiary", DEFAULTS.tertiary),
    accent: cssValue("--color-accent", DEFAULTS.accent),
    light: cssValue("--color-light", DEFAULTS.light),
    lightBackground: cssValue("--color-light-background", DEFAULTS.lightBackground),
    responseBackground: cssValue("--color-tertiary-60", "#E1F399"),
    fontFamily: cssValue("--font-family", DEFAULTS.fontFamily),
    assets: {
      cover: asset("cover.png"), header: asset("header.png"), footer: asset("footer.png"),
    },
  };
}

export function hexToRgb(value, fallback = "#000000") {
  const hex = String(value || fallback).trim().replace(/^#/, "");
  const normalized = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return { r: 0, g: 0, b: 0 };
  return { r: ((number >> 16) & 255) / 255, g: ((number >> 8) & 255) / 255, b: (number & 255) / 255 };
}

export async function loadBrandImage(url) {
  for (const candidate of Array.isArray(url) ? url : [url]) {
    try {
      const response = await fetch(candidate);
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch { /* try the next location */ }
  }
  return null;
}

