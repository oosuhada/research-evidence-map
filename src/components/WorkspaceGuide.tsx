import { ArrowRight, Check, X } from 'lucide-react';

const steps = [
  { title: 'Start with sources', body: 'The demo contains synthetic interviews, support notes, and contradictory feedback. Open the source register before trusting any synthesis.', target: 'sources' },
  { title: 'Review proposed evidence', body: 'Analysis creates proposals, not facts. Open an evidence item and inspect the exact source fragment, review state, and provenance.', target: 'evidence' },
  { title: 'Look for research gaps', body: 'Research State summarizes source coverage, review backlog, contradictions, and the next evidence action using only stored research state.', target: 'research-health' },
  { title: 'Challenge the opportunity', body: 'The demo includes an evidence-backed opportunity. Run the challenge to see what disconfirming evidence is still missing.', target: 'opportunities' },
];

type Props = { step: number; onStep: (step: number) => void; onClose: () => void };

export function WorkspaceGuide({ step, onStep, onClose }: Props) {
  const complete = step >= steps.length;
  const current = steps[Math.min(step, steps.length - 1)];
  const go = (next: number) => {
    onStep(next);
    const target = steps[next]?.target;
    if (target) window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  return <aside className="workspace-guide" aria-live="polite">
    <div className="workspace-guide-head"><span>GUIDED DEMO</span><button type="button" onClick={onClose} aria-label="Close guide"><X size={14} /></button></div>
    {complete ? <div className="workspace-guide-complete"><Check size={18} /><div><strong>You have seen the complete research loop.</strong><p>Return to the archive and create a workspace with your own source material when you are ready.</p></div></div> : <>
      <div className="workspace-guide-progress"><b>{step + 1}</b><span>/ {steps.length}</span><i><b style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></i></div>
      <h3>{current.title}</h3><p>{current.body}</p>
      <div className="workspace-guide-actions">{step > 0 ? <button type="button" onClick={() => go(step - 1)}>Back</button> : <span />}<button type="button" className="primary" onClick={() => go(step + 1)}>{step === steps.length - 1 ? 'Finish' : 'Next'}<ArrowRight size={13} /></button></div>
    </>}
  </aside>;
}
