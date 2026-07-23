const CELEBRATE_KEY = "humanbond:celebrate-bond";
const DISSOLVE_KEY = "humanbond:dissolve-bond";

export function setBondCelebrationFlag(): void {
  try {
    sessionStorage.setItem(CELEBRATE_KEY, "1");
  } catch {
    // Private browsing or storage disabled
  }
}

export function peekBondCelebrationFlag(): boolean {
  try {
    return sessionStorage.getItem(CELEBRATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function consumeBondCelebrationFlag(): void {
  try {
    sessionStorage.removeItem(CELEBRATE_KEY);
  } catch {
    // Ignore
  }
}

export type DissolutionOverlayData = {
  partnerName?: string;
};

export function setDissolutionOverlayFlag(partnerName?: string): void {
  try {
    const payload: DissolutionOverlayData = { partnerName };
    sessionStorage.setItem(DISSOLVE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing or storage disabled
  }
}

export function peekDissolutionOverlay(): DissolutionOverlayData | null {
  try {
    const raw = sessionStorage.getItem(DISSOLVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DissolutionOverlayData;
  } catch {
    return null;
  }
}

export function consumeDissolutionOverlayFlag(): void {
  try {
    sessionStorage.removeItem(DISSOLVE_KEY);
  } catch {
    // Ignore
  }
}
