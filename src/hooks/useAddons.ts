import { useMemo } from "react";
import { ADDON_REGISTRY, type Addon } from "@/lib/addons";

export function useAddons(rawSettings: Record<string, string>): Addon[] {
  return useMemo(
    () =>
      ADDON_REGISTRY.map((addon) => ({
        ...addon,
        status: resolveStatus(addon, rawSettings),
      })),
    [rawSettings],
  );
}

function resolveStatus(addon: Addon, settings: Record<string, string>): Addon["status"] {
  if (addon.requiredKeys.length === 0) {
    return settings[`addon_${addon.id}_enabled`] === "true" ? "active" : "inactive";
  }
  return addon.requiredKeys.every((k) => settings[k] && settings[k].trim() !== "")
    ? "active"
    : "inactive";
}

export function isAddonActive(addonId: string, rawSettings: Record<string, string>): boolean {
  const addon = ADDON_REGISTRY.find((a) => a.id === addonId);
  if (!addon) return false;
  return resolveStatus(addon, rawSettings) === "active";
}
