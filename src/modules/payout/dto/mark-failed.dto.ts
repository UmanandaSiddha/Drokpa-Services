// MarkFailedDto is not needed as markFailed() only requires payoutId (from route)
// The ProviderPayout schema does not have a field for storing failure reasons.
// Consider adding a 'failureReason' or 'notes' field to the schema if needed.
export class MarkFailedDto { }