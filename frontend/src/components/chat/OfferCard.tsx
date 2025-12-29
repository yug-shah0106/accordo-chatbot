import "./OfferCard.css";

interface OfferCardProps {
  offer: {
    unit_price?: number | null;
    payment_terms?: string | null;
  };
}

export default function OfferCard({ offer }: OfferCardProps) {
  const hasPrice = offer.unit_price !== null && offer.unit_price !== undefined;
  const hasTerms = offer.payment_terms && offer.payment_terms.trim().length > 0;
  
  if (!hasPrice && !hasTerms) return null;

  return (
    <div className="offer-card">
      <span className="offer-card-label">Proposed:</span>
      {hasPrice && <span className="offer-card-value">${offer.unit_price}</span>}
      {hasPrice && hasTerms && <span className="offer-card-separator">•</span>}
      {hasTerms && <span className="offer-card-value">{offer.payment_terms}</span>}
    </div>
  );
}
