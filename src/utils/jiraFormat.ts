/**
 * Converts the constrained Markdown produced by Fetchy's AI bug-report template
 * into Jira wiki markup.
 *
 * The Jira REST API v2 `description` field is rendered as wiki markup, not
 * Markdown. Left unconverted, Markdown headings (`#`, `##`, `###`) are misread
 * by Jira as nested numbered-list markers — e.g. `## Severity` renders as
 * "1. 1. Severity" instead of a heading. This converts headings, bold/italic
 * emphasis, inline code, code fences, bullet lists, and links to their wiki
 * markup equivalents.
 */
export function markdownToJiraWiki(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const fenceMatch = line.match(/^```\s*(\w*)\s*$/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = fenceMatch[1];
        output.push(lang ? `{code:${lang}}` : '{code}');
      } else {
        inCodeBlock = false;
        output.push('{code}');
      }
      continue;
    }

    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      output.push(`h${headingMatch[1].length}. ${headingMatch[2].trim()}`);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const withBullet = bulletMatch ? `* ${bulletMatch[1]}` : line;

    output.push(
      withBullet
        .replace(/\*\*\*(.+?)\*\*\*/g, '_*$1*_')
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/`([^`]+)`/g, '{{$1}}')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1|$2]')
    );
  }

  return output.join('\n');
}
