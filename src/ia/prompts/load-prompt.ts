import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const templateCache = new Map<string, string>();

export function loadPromptTemplate(
  filename: string,
  variables: Record<string, string>,
): string {
  let template = templateCache.get(filename);
  if (template === undefined) {
    template = readFileSync(join(__dirname, filename), 'utf8');
    templateCache.set(filename, template);
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      throw new Error(
        `Prompt template "${filename}" expects variable "${key}" but it was not provided.`,
      );
    }
    return variables[key];
  });
}

export function _resetPromptCacheForTests(): void {
  templateCache.clear();
}
