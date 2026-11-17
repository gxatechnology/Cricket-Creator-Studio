import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCsvTemplate,
  mergeImportedQuestionsIntoProject,
  parseQuestionsFromCsv,
  parseQuestionsFromJson,
  parseQuestionsFromPasteText,
} from './questionImporter';
import { createBlankProject } from './storage';

test('parseQuestionsFromCsv validates valid rows, missing options, duplicates, and invalid answers', () => {
  const csv = [
    generateCsvTemplate(),
    '"Duplicate row?","20 yards","22 yards","24 yards","18 yards","B","22 yards.","Pitch Laws","easy"',
    '"What is the length of a standard cricket pitch?","20 yards","22 yards","24 yards","18 yards","B","Dup","Pitch Laws","easy"',
    '"Missing option row?","Opt1","","Opt3","Opt4","A","Exp","Rules","medium"',
    '"Missing answer row?","Opt1","Opt2","Opt3","Opt4","","Exp","Rules","medium"',
    '"Invalid answer row?","Opt1","Opt2","Opt3","Opt4","Z","Exp","Rules","medium"',
  ].join('\n');

  const rows = parseQuestionsFromCsv(csv);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].isValid, true);
  assert.equal(rows[1].isValid, true);
  assert.equal(rows[2].isValid, true);
  assert.ok(rows[3].issues.includes('duplicate-question'));
  assert.ok(rows[4].issues.includes('missing-option'));
  assert.ok(rows[5].issues.includes('missing-answer'));
  assert.ok(rows[6].issues.includes('invalid-correct-answer'));
});

test('parseQuestionsFromPasteText parses multi-line quiz blocks', () => {
  const text = `1. How many players are in a cricket team?
A) 9
B) 10
C) 11
D) 12
Answer: C
Explanation: Eleven players take the field.`;

  const rows = parseQuestionsFromPasteText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isValid, true);
  assert.equal(rows[0].correctIndex, 2);
});

test('mergeImportedQuestionsIntoProject supports up to 100 questions', () => {
  const proj = createBlankProject('100Q Project');
  const bulk = Array.from({ length: 105 }, (_, i) => ({
    prompt: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correct: 'A',
  }));
  const parsed = parseQuestionsFromJson(JSON.stringify(bulk));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const merged = mergeImportedQuestionsIntoProject(
      proj.quizQuestions,
      parsed.rows,
      'replace'
    );
    assert.equal(merged.length, 100);
  }
});
