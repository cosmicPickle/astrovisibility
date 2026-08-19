export type SkySelectionHandoff = Readonly<{
  profileId: string;
  targetId: string;
  window: Readonly<{
    startTimestampUtc: string;
    endTimestampUtc: string;
  }>;
}>;

const pendingSelections = new Map<string, SkySelectionHandoff>();

export function publishSkySelectionHandoff(handoff: SkySelectionHandoff): void {
  pendingSelections.set(handoff.profileId, Object.freeze({ ...handoff }));
}

export function consumeSkySelectionHandoff(
  profileId: string,
): SkySelectionHandoff | null {
  const handoff = pendingSelections.get(profileId) ?? null;
  if (handoff) pendingSelections.delete(profileId);
  return handoff;
}

export function clearSkySelectionHandoffs(): void {
  pendingSelections.clear();
}
