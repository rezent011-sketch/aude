import { DISCORD_MAX_LENGTH, splitMessage, truncate } from '../utils/discord';

describe('splitMessage', () => {
  it('returns the original text when it fits in one Discord message', () => {
    expect(splitMessage('short message')).toEqual(['short message']);
  });

  it('splits on a newline before hitting the Discord limit', () => {
    const input = `${'a'.repeat(DISCORD_MAX_LENGTH - 10)}\nsecond line`;

    const parts = splitMessage(input);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(DISCORD_MAX_LENGTH - 10);
    expect(parts[1]).toBe('second line');
  });

  it('hard splits long text without whitespace', () => {
    const input = 'x'.repeat(DISCORD_MAX_LENGTH + 25);

    const parts = splitMessage(input);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(DISCORD_MAX_LENGTH);
    expect(parts[1]).toHaveLength(25);
  });
});

describe('truncate', () => {
  it('adds an ellipsis when the text exceeds the max length', () => {
    expect(truncate('abcdefghij', 7)).toBe('abcd...');
  });

  it('leaves short text unchanged', () => {
    expect(truncate('abc', 7)).toBe('abc');
  });
});
