import { ArrowRight, Check, X } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

type Props = { step: number; onStep: (step: number) => void; onClose: () => void };

export function WorkspaceGuide({ step, onStep, onClose }: Props) {
  const { text } = useLocale();
  const steps = [
    { title: text('Start with sources', '원문부터 시작하세요'), body: text('The demo contains synthetic interviews, support notes, and contradictory feedback. Open the source register before trusting any synthesis.', '데모에는 가상 인터뷰, 고객지원 노트, 상충되는 피드백이 들어 있습니다. 종합 결과를 믿기 전에 원문 목록부터 확인하세요.'), target: 'sources' },
    { title: text('Review proposed evidence', 'AI가 제안한 근거를 검토하세요'), body: text('Analysis creates proposals, not facts. Open an evidence item and inspect the exact source fragment, review state, and provenance.', '분석은 사실이 아니라 제안을 만듭니다. 근거 항목을 열어 정확한 원문 fragment와 검토 상태, 출처를 확인하세요.'), target: 'evidence' },
    { title: text('Look for research gaps', '리서치 빈틈을 확인하세요'), body: text('Research State summarizes source coverage, review backlog, contradictions, and the next evidence action using only stored research state.', 'Research State는 저장된 상태만으로 원문 커버리지, 검토 대기, 상충 근거, 다음 근거 액션을 보여줍니다.'), target: 'research-health' },
    { title: text('Challenge the opportunity', '기회를 반증해보세요'), body: text('The demo includes an evidence-backed opportunity. Run the challenge to see what disconfirming evidence is still missing.', '데모에는 근거 기반 기회가 포함되어 있습니다. 반증을 실행해 어떤 반대 근거가 아직 빠져 있는지 확인하세요.'), target: 'opportunities' },
  ];
  const complete = step >= steps.length;
  const current = steps[Math.min(step, steps.length - 1)];
  const go = (next: number) => {
    onStep(next);
    const target = steps[next]?.target;
    if (target) window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  return <aside className="workspace-guide" aria-live="polite">
    <div className="workspace-guide-head"><span>{text('GUIDED DEMO', '가이드 데모')}</span><button type="button" onClick={onClose} aria-label={text('Close guide', '가이드 닫기')}><X size={14} /></button></div>
    {complete ? <div className="workspace-guide-complete"><Check size={18} /><div><strong>{text('You have seen the complete research loop.', '전체 리서치 흐름을 확인했습니다.')}</strong><p>{text('Return to the archive and create a workspace with your own source material when you are ready.', '준비되면 아카이브로 돌아가 실제 원문 자료로 워크스페이스를 만들어보세요.')}</p></div></div> : <>
      <div className="workspace-guide-progress"><b>{step + 1}</b><span>/ {steps.length}</span><i><b style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></i></div>
      <h3>{current.title}</h3><p>{current.body}</p>
      <div className="workspace-guide-actions">{step > 0 ? <button type="button" onClick={() => go(step - 1)}>{text('Back', '이전')}</button> : <span />}<button type="button" className="primary" onClick={() => go(step + 1)}>{step === steps.length - 1 ? text('Finish', '완료') : text('Next', '다음')}<ArrowRight size={13} /></button></div>
    </>}
  </aside>;
}
