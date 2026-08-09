export interface WindowColor {
  readonly name: string;
  readonly value: string;
}

// Saturated enough to remain recognizable on both dark and light themes.
export const PALETTE: readonly WindowColor[] = [
  { name: "Ruby", value: "#E5484D" },
  { name: "Tomato", value: "#E54D2E" },
  { name: "Orange", value: "#F76B15" },
  { name: "Amber", value: "#F5A524" },
  { name: "Yellow", value: "#D8B400" },
  { name: "Lime", value: "#7FB800" },
  { name: "Green", value: "#30A46C" },
  { name: "Mint", value: "#00A98F" },
  { name: "Cyan", value: "#00A2C7" },
  { name: "Sky", value: "#0090FF" },
  { name: "Blue", value: "#3E63DD" },
  { name: "Indigo", value: "#5B5BD6" },
  { name: "Violet", value: "#8E4EC6" },
  { name: "Purple", value: "#AB4ABA" },
  { name: "Pink", value: "#D6409F" },
  { name: "Crimson", value: "#E93D82" }
];

export function chooseRandom(except?: string): WindowColor {
  const choices = except ? PALETTE.filter((color) => color.value !== except) : PALETTE;
  return choices[Math.floor(Math.random() * choices.length)];
}
