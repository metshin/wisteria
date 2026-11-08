/** A sentence with the word marked inside it. */
export default function WordContext({ text, word }: { text: string; word: string }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0 || !word) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="ctx-mark">{text.slice(i, i + word.length)}</mark>{text.slice(i + word.length)}</>;
}
