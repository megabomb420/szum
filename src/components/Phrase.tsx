import { APPEAR_AFTER, HOLD_FOR, phrases, segmentIndex } from '../lib/phrases';

type Props = {
  time: number;
  boundaries: number[];
};

export default function Phrase({ time, boundaries }: Props) {
  const index = segmentIndex(time, boundaries);
  const start = index === 0 ? 0 : boundaries[index - 1];
  const elapsed = time - start;
  const visible = time > 0 && elapsed >= APPEAR_AFTER && elapsed < APPEAR_AFTER + HOLD_FOR;
  const text = phrases[index] ?? '';

  return (
    <div className={`phrase${visible ? ' is-visible' : ''}`} aria-hidden={!visible}>
      <p className="phrase__text">{text}</p>
    </div>
  );
}
