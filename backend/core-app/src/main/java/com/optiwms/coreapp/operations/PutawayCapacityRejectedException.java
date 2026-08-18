package com.optiwms.coreapp.operations;

import java.util.List;

/**
 * The chosen bin cannot take this pallet, together with bins that can.
 *
 * <p>A bare "Location pallet capacity reached" left the worker standing at a rack with nowhere to
 * go and no way to finish the job. The re-planning needed to answer "then where?" already existed;
 * it simply was not run at the point of failure. Carrying the alternatives on the exception lets
 * the API hand the worker somewhere to walk to instead of a dead end.
 */
public class PutawayCapacityRejectedException extends RuntimeException {

    private final List<String> violations;
    private final List<Alternative> alternatives;

    public PutawayCapacityRejectedException(
            String locationCode, List<String> violations, List<Alternative> alternatives) {
        super(buildMessage(locationCode, violations, alternatives));
        this.violations = List.copyOf(violations);
        this.alternatives = List.copyOf(alternatives);
    }

    public List<String> getViolations() {
        return violations;
    }

    public List<Alternative> getAlternatives() {
        return alternatives;
    }

    private static String buildMessage(
            String locationCode, List<String> violations, List<Alternative> alternatives) {
        StringBuilder message = new StringBuilder(String.join("; ", violations));
        if (!alternatives.isEmpty()) {
            message.append(". Try ")
                    .append(alternatives.get(0).locationCode())
                    .append(alternatives.size() > 1
                            ? " (" + (alternatives.size() - 1) + " more available)"
                            : "");
        } else {
            message.append(". No alternative bin has room for this pallet right now.");
        }
        return message.toString();
    }

    /** A bin that can take the pallet the rejected one could not. */
    public record Alternative(String locationCode, int allocatableQuantity, String reason) {
    }
}
