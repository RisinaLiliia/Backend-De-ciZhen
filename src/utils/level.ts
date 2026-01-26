// src/utils/level.ts
export type UserLevel =
  | "Novice"
  | "Explorer"
  | "Navigator"
  | "Expert"
  | "Legend";

export function calculateLevel(deciCoins: number): UserLevel {
  const levels: { min: number; level: UserLevel }[] = [
    { min: 2000, level: "Legend" },
    { min: 1000, level: "Expert" },
    { min: 500, level: "Navigator" },
    { min: 100, level: "Explorer" },
  ];

  return levels.find((l) => deciCoins >= l.min)?.level ?? "Novice";
}
