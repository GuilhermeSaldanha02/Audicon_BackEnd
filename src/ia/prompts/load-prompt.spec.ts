import {
  _resetPromptCacheForTests,
  loadPromptTemplate,
} from './load-prompt';

describe('loadPromptTemplate', () => {
  beforeEach(() => _resetPromptCacheForTests());

  it('renders the analyze-infraction.v1 template with description', () => {
    const out = loadPromptTemplate('analyze-infraction.v1.md', {
      description: 'Barulho após 22h',
    });
    expect(out).toContain('"Barulho após 22h"');
    expect(out).toContain('descricao_formal');
    expect(out).toContain('penalidade_sugerida');
    expect(out).not.toContain('{{description}}');
  });

  it('throws when a required variable is missing', () => {
    expect(() =>
      loadPromptTemplate('analyze-infraction.v1.md', {} as any),
    ).toThrow(/description/);
  });

  it('throws when the template file does not exist', () => {
    expect(() =>
      loadPromptTemplate('does-not-exist.md', { description: 'x' }),
    ).toThrow();
  });

  it('caches the template content between calls', () => {
    const a = loadPromptTemplate('analyze-infraction.v1.md', {
      description: 'A',
    });
    const b = loadPromptTemplate('analyze-infraction.v1.md', {
      description: 'B',
    });
    expect(a).toContain('"A"');
    expect(b).toContain('"B"');
  });
});
