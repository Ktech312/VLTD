// Bulk upload intake: which of the chosen files are taken, and which are named as NOT taken (never dropped silently).
// Audit ADD-432: 62 photos chosen, 60 taken, nothing said about the other 2 (and the cap was applied per pick, so two picks could pass it).

export type IntakeFile = { name: string; type: string };
export type IntakePlan<T extends IntakeFile> = {
  accepted: T[];
  /** Photos that did not fit under the limit (named, so they can be added in another upload). */
  overLimit: T[];
  /** Files that are not photos. */
  notPhotos: T[];
};

export function planBulkIntake<T extends IntakeFile>(files: T[], alreadyQueued: number, max: number): IntakePlan<T> {
  const photos = files.filter((f) => String(f.type).startsWith("image/"));
  const notPhotos = files.filter((f) => !String(f.type).startsWith("image/"));
  const room = Math.max(0, max - alreadyQueued);
  return { accepted: photos.slice(0, room), overLimit: photos.slice(room), notPhotos };
}

/** The sentence shown right after choosing: what was added and exactly what was not. Empty when everything was taken. */
export function intakeNotice(plan: { accepted: IntakeFile[]; overLimit: IntakeFile[]; notPhotos: IntakeFile[] }, max: number): string {
  const lines: string[] = [];
  if (plan.overLimit.length > 0) {
    lines.push(`One upload takes up to ${max} photos. Added ${plan.accepted.length}; ${plan.overLimit.length} not added: ${names(plan.overLimit)}. Add them in another upload after this one.`);
  }
  if (plan.notPhotos.length > 0) {
    lines.push(`${plan.notPhotos.length} file${plan.notPhotos.length === 1 ? " is" : "s are"} not a photo and ${plan.notPhotos.length === 1 ? "was" : "were"} not added: ${names(plan.notPhotos)}.`);
  }
  return lines.join(" ");
}

function names(files: IntakeFile[]): string {
  const shown = files.slice(0, 6).map((f) => f.name || "(unnamed)");
  return files.length > 6 ? `${shown.join(", ")} and ${files.length - 6} more` : shown.join(", ");
}
