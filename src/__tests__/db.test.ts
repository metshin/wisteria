import { describe, expect, it } from 'vitest';
import { emptyData, normalize } from '../store/db';
import { PRESETS } from '../logic/presets';

describe('loading older saves', () => {
  it('fills in the builder mode, domain grid and notes when they are missing', () => {
    const old = JSON.parse(JSON.stringify(emptyData()));
    old.settings.builder = { hard: 10, medium: 5, easy: 0, timerMin: 20, skills: ['Inferences'] };
    delete old.notes;
    const d = normalize(old);
    expect(d.settings.builder).toMatchObject({ mode: 'difficulty', hard: 10, medium: 5, none: 0, timerMin: 20, skills: ['Inferences'] });
    expect(d.settings.builder.grid).toEqual(PRESETS[0].grid);
    expect(d.notes).toEqual([]);
  });

  it('keeps a saved grid and fills any domain that is missing from it', () => {
    const old = JSON.parse(JSON.stringify(emptyData()));
    old.settings.builder = { ...old.settings.builder, mode: 'domain', grid: { 'Craft and Structure': { easy: 5, medium: 0, hard: 1 } } };
    const g = normalize(old).settings.builder.grid;
    expect(g['Craft and Structure']).toEqual({ easy: 5, medium: 0, hard: 1 });
    expect(g['Expression of Ideas']).toEqual(PRESETS[0].grid['Expression of Ideas']);
  });
});
