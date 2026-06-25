import { useEffect, useRef } from 'react';
import rough from 'roughjs';

export function ProofMark({ kind = 'circle' }: { kind?: 'circle' | 'underline' | 'strike' }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();
    const rc = rough.svg(svg);
    const options = { stroke: '#c54f39', strokeWidth: 1.4, roughness: 1.7, bowing: 1.2 };
    const mark = kind === 'circle'
      ? rc.ellipse(28, 18, 48, 28, options)
      : kind === 'underline'
        ? rc.line(4, 28, 54, 24, options)
        : rc.line(4, 4, 54, 30, options);
    svg.appendChild(mark);
  }, [kind]);

  return <svg className="proof-mark" ref={ref} viewBox="0 0 58 36" aria-hidden="true" />;
}
