import "./AboutPage.css";

export default function About() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <h1>What is Accordo.ai?</h1>
        <p className="hero-subtitle">
          AI-powered negotiation agent that scales your procurement negotiations
        </p>
      </div>

      {/* Demo Video Placeholder */}
      <div className="demo-section">
        <div className="demo-placeholder">
          <p>30-second demo video</p>
          <span className="demo-note">(Placeholder for demo GIF/video)</span>
        </div>
      </div>

      {/* 4 Main Blocks */}
      <div className="about-blocks">
        {/* Block 1: Problem */}
        <div className="about-block problem-block">
          <h2>The Problem</h2>
          <h3>Negotiations Don't Scale</h3>
          <div className="block-content">
            <p>
              Procurement teams spend countless hours negotiating with vendors—reviewing offers,
              calculating trade-offs, and crafting responses. As your business grows, the volume
              of negotiations becomes overwhelming.
            </p>
            <ul>
              <li>Manual negotiations are time-consuming and inconsistent</li>
              <li>Human negotiators can't handle high-volume deals simultaneously</li>
              <li>Key terms get missed or overlooked in fast-paced negotiations</li>
              <li>No systematic way to enforce business policies across all deals</li>
            </ul>
          </div>
        </div>

        {/* Block 2: Solution */}
        <div className="about-block solution-block">
          <h2>The Solution</h2>
          <h3>Policy-Controlled Negotiation Agent</h3>
          <div className="block-content">
            <p>
              Accordo.ai is an AI agent that negotiates on your behalf, following your business
              policies and guardrails. It scales to handle unlimited negotiations simultaneously
              while maintaining consistency and compliance.
            </p>
            <ul>
              <li>Automated negotiation that works 24/7</li>
              <li>Policy-driven decisions based on your business rules</li>
              <li>Consistent application of guardrails across all deals</li>
              <li>Full audit trail of every decision and counter-offer</li>
            </ul>
          </div>
        </div>

        {/* Block 3: How It Works */}
        <div className="about-block how-it-works-block">
          <h2>How It Works</h2>
          <h3>Extract • Evaluate • Counter • Audit</h3>
          <div className="block-content">
            <div className="workflow">
              <div className="workflow-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Extract</h4>
                  <p>
                    Parse vendor messages to extract key terms: unit price, payment terms,
                    and conditions using NLP and structured extraction.
                  </p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Evaluate</h4>
                  <p>
                    Calculate utility scores based on your policy (anchor, target, max acceptable)
                    and determine if the offer meets your thresholds.
                  </p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Counter</h4>
                  <p>
                    Generate intelligent counter-offers using LLMs, following your concession
                    strategy and maintaining professional communication.
                  </p>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h4>Audit</h4>
                  <p>
                    Track every decision, offer, and response with full transparency. Review
                    negotiation summaries and understand why each decision was made.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Block 4: Why It's Safe */}
        <div className="about-block safety-block">
          <h2>Why It's Safe</h2>
          <h3>Guardrails + Human Approval (Future)</h3>
          <div className="block-content">
            <p>
              Accordo.ai is built with safety and control at its core. Every decision is
              constrained by your business policies, and you maintain full visibility and control.
            </p>
            <div className="safety-features">
              <div className="safety-feature">
                <h4>Policy Guardrails</h4>
                <p>
                  Hard limits on acceptable terms (e.g., max price, minimum payment terms).
                  The agent cannot exceed these boundaries.
                </p>
              </div>
              <div className="safety-feature">
                <h4>Utility Thresholds</h4>
                <p>
                  Automatic acceptance/walk-away thresholds based on calculated utility scores.
                  No decisions outside your defined parameters.
                </p>
              </div>
              <div className="safety-feature">
                <h4>Full Transparency</h4>
                <p>
                  Every decision is logged with reasoning. Review why the agent accepted,
                  countered, or walked away from any offer.
                </p>
              </div>
              <div className="safety-feature">
                <h4>Human Approval (Future)</h4>
                <p>
                  Optional human-in-the-loop approval for high-value deals or when guardrails
                  are triggered. You stay in control.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="about-cta">
        <h2>Ready to see it in action?</h2>
        <p>Create a deal and watch Accordo.ai negotiate on your behalf.</p>
      </div>
    </div>
  );
}
