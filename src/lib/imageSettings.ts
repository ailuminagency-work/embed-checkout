export type ImageFit = "cover" | "contain";

export interface ImageSettings {
  fit: ImageFit;
  positionX: number; // 0-100
  positionY: number; // 0-100
  zoom: number; // percent, 100 = default
}

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  fit: "cover",
  positionX: 50,
  positionY: 50,
  zoom: 100,
};

export function parseImageSettings(value: unknown): ImageSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_IMAGE_SETTINGS };
  const v = value as Record<string, unknown>;
  const fit = v.fit === "contain" ? "contain" : "cover";
  const num = (x: unknown, fallback: number) => {
    const n = typeof x === "number" ? x : Number(x);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    fit,
    positionX: Math.min(100, Math.max(0, num(v.positionX, 50))),
    positionY: Math.min(100, Math.max(0, num(v.positionY, 50))),
    zoom: Math.min(300, Math.max(50, num(v.zoom, 100))),
  };
}

export function imgStyle(settings: ImageSettings): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: settings.fit,
    objectPosition: `${settings.positionX}% ${settings.positionY}%`,
    transform: `scale(${settings.zoom / 100})`,
    transformOrigin: `${settings.positionX}% ${settings.positionY}%`,
  };
}