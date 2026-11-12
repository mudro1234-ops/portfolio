/** Connection health of a hardware tracker, judged only from when we last heard from it. */
export function deviceConnection(lastCommunicationAt: string | null, expectedIntervalSeconds: number, status: string):
  { label: string; tone: "green" | "amber" | "red" | "grey" } {
  if (status !== "active") return { label: "Inactive", tone: "grey" };
  if (!lastCommunicationAt) return { label: "Never connected", tone: "grey" };
  const age = (Date.now() - new Date(lastCommunicationAt).getTime()) / 1000;
  const grace = Math.max(expectedIntervalSeconds * 3, 180);
  if (age <= grace) return { label: "Reporting", tone: "green" };
  if (age <= Math.max(grace * 5, 900)) return { label: "Delayed", tone: "amber" };
  return { label: "Offline", tone: "red" };
}
