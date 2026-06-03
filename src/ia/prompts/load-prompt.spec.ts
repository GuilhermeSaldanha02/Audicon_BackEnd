import { _resetPromptCacheForTests, loadPromptTemplate } from './load-prompt';

describe('loadPromptTemplate', () => {
  beforeEach(() => _resetPromptCacheForTests());

  it('renders the analyze-infraction.v1 template with description and severity', () => {
    const out = loadPromptTemplate('analyze-infraction.v1.md', {
      description: 'Barulho após 22h',
      severity: 'GRAVE',
    });
    expect(out).toContain('"Barulho após 22h"');
    expect(out).toContain('GRAVE');
    expect(out).toContain('descricao_formal');
    expect(out).toContain('penalidade_sugerida');
    expect(out).not.toContain('{{description}}');
    expect(out).not.toContain('{{severity}}');
  });

  it('throws when a required variable is missing', () => {
    // severity presente, description ausente → deve reclamar de description
    expect(() =>
      loadPromptTemplate('analyze-infraction.v1.md', {
        severity: 'MEDIA',
      } as any),
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
      severity: 'LEVE',
    });
    const b = loadPromptTemplate('analyze-infraction.v1.md', {
      description: 'B',
      severity: 'LEVE',
    });
    expect(a).toContain('"A"');
    expect(b).toContain('"B"');
  });
});
