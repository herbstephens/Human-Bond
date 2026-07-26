/**
 * "How it works" — four outline icon badges on a hairline connector, plus the
 * growing TIME dots that run out of the third step into the fourth.
 *
 * DOM order matters: `.time-connector` sits between step 3 and step 4 so the
 * mockup's `.step-card:last-of-type .step-icon` pulse lands on "Earn TIME".
 */

import { AgentIcon, BondIcon, ClockIcon, RingsIcon } from './icons';

const TIME_DOTS = [1, 2, 3, 4];

export function HowItWorks() {
  return (
    <section className="steps-section" aria-labelledby="how-it-works-title">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2 className="section-title" id="how-it-works-title">
            Three steps to create a bond your agent helps manage
          </h2>
          <p className="section-sub">Let your agents coordinate the work while you approve what matters.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">
              <BondIcon />
            </div>
            <div className="step-title">Verify your humanity</div>
            <p className="step-desc">Create your identity with World ID and unlock your Bond&nbsp;Agent.</p>
          </div>

          <div className="step-card">
            <div className="step-icon">
              <RingsIcon />
            </div>
            <div className="step-title">Bond with your partner</div>
            <p className="step-desc">
              World ID-verified humans form a bond on Worldchain with a smart contract&nbsp;wallet.
            </p>
          </div>

          <div className="step-card">
            <div className="step-icon">
              <AgentIcon />
            </div>
            <div className="step-title">Delegate to your agents</div>
            <p className="step-desc">
              Your Bond Agent handles routine work, proposes actions, and keeps you updated, always leaving
              you&nbsp;the&nbsp;final&nbsp;say.
            </p>
          </div>

          <div className="time-connector" aria-hidden="true">
            {TIME_DOTS.map(size => (
              <span key={size} className={`time-dot time-dot--${size}`} />
            ))}
          </div>

          <div className="step-card">
            <div className="step-icon">
              <ClockIcon />
            </div>
            <div className="step-title">Earn TIME</div>
            <p className="step-desc">TIME accrues to both partners as long as the bond&nbsp;lasts.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
