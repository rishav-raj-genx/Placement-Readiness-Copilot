export function resolveInterviewFocusTopics(
  targetRole: string,
  topics: readonly string[],
): string[] {
  const normalizedTopics = topics
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);

  return normalizedTopics.length > 0
    ? normalizedTopics
    : [`General ${targetRole.trim()} Concepts`];
}
