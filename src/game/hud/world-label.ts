/** World numbers as shown to the player: The Lost Levels' worlds 10-13 are A, B, C and D. */
export function worldLabel(world: number): string {
  return world >= 10 && world <= 13 ? ('ABCD'[world - 10] as string) : String(world);
}
