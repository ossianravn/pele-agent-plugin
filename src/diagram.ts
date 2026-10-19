import { PeleError, render } from 'pele';

export type Checked =
  | { ok: true; type: string; width: number; height: number }
  | { ok: false; code: string; message: string; line: number; column: number; snippet: string };

const SUPPORTED_HEADERS = [
  'flowchart', 'sequenceDiagram', 'stateDiagram-v2', 'classDiagram', 'erDiagram', 'gantt', 'timeline',
  'journey', 'kanban', 'mindmap', 'gitGraph', 'pie', 'xychart', 'quadrantChart', 'sankey', 'treemap-beta',
  'block', 'C4Context', 'requirementDiagram', 'packet', 'architecture-beta', 'swimlane-beta',
  'agentflow-beta', 'treeView-beta', 'ishikawa-beta', 'radar-beta', 'venn-beta', 'cynefin-beta',
  'wardley-beta', 'usecase-beta', 'eventmodeling', 'railroad-ebnf-beta',
];

/** Runs the full pele pipeline so the agent learns about every error the viewer would show. */
export function checkDiagram(source: string): Checked {
  try {
    const result = render(source);
    return { ok: true, type: result.type, width: result.width, height: result.height };
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    return {
      ok: false,
      code: error.code,
      message: error.message,
      line: error.line,
      column: error.column,
      snippet: error.snippet,
    };
  }
}

export function describeError(error: Extract<Checked, { ok: false }>): string {
  const where = error.line ? ` at line ${error.line}, column ${error.column}` : '';
  const lines = [`The diagram was not shown: ${error.code} error${where}.`, error.message];
  if (error.code === 'unsupported-diagram') {
    lines.push(`Start the source with a diagram header such as: ${SUPPORTED_HEADERS.join(', ')}.`);
  } else if (error.code === 'limit') {
    lines.push('Split the diagram into smaller ones or remove detail.');
  } else {
    lines.push('Fix the source and call show_diagram again.');
  }
  return lines.join('\n');
}
