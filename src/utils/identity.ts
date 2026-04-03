export function buildProblemKey(questionFrontendId: string, titleSlug: string): string {
  return `${questionFrontendId}::${titleSlug}`;
}
