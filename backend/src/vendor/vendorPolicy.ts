export const vendorPolicy = {
  // Vendor-side: higher price is better, shorter terms are better
  min_price: 90,             // vendor won't go below this
  start_price: 110,          // vendor anchor
  preferred_terms: "Net 30", // vendor likes Net 30
  worst_terms: "Net 90",     // vendor hates Net 90
  concession_step: 2,        // price decrease per round if pressured
  max_rounds: 6
} as const;



