/**
 * "Why HumanBond" — four claims separated by hairlines, no card boxes.
 */

import { ClockIcon, EyeIcon, LockIcon, ShieldCheckIcon } from './icons';

const VALUES = [
  {
    Icon: ShieldCheckIcon,
    title: 'Less mental load',
    desc: <>Your agents handle routine work, so you don&apos;t have to remember&nbsp;everything.</>,
  },
  {
    Icon: LockIcon,
    title: 'Fewer everyday decisions',
    desc: <>Less back-and-forth on recurring financial and logistical&nbsp;decisions.</>,
  },
  {
    Icon: EyeIcon,
    title: 'Stay on top of things',
    desc: <>Your agents track tasks, updates, and responsibilities for both&nbsp;partners.</>,
  },
  {
    Icon: ClockIcon,
    title: 'More time for what matters',
    desc: <>Less time managing your partnership, more time on shared&nbsp;goals.</>,
  },
];

export function ValueProps() {
  return (
    <section className="values-section" aria-labelledby="why-title">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Why HumanBond</div>
          <h2 className="section-title" id="why-title">
            Partnerships are hard to manage. They shouldn&apos;t be
          </h2>
          <p className="section-sub">HumanBond improves how partnerships operate.</p>
        </div>

        <div className="values-grid">
          {VALUES.map(({ Icon, title, desc }) => (
            <div className="value-item" key={title}>
              <div className="value-icon">
                <Icon />
              </div>
              <div className="value-title">{title}</div>
              <p className="value-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
