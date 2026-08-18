package com.optiwms.coreapp.operations;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the bookkeeping markers a putaway task carries in its notes.
 *
 * <p>A putaway task is one pallet, and three facts about that pallet are stored in the notes
 * alongside the human-readable instruction: how much this pallet owes ({@code PUTAWAY_HU_QTY}),
 * how much of it is already away ({@code PUTAWAY_PROGRESS}), and why it was set aside
 * ({@code PUTAWAY_SKIP_REASON}). Parsing lived privately inside {@link PutawayService} and was
 * re-implemented in the worker UI; both read the same markers, so both now read them the same way.
 */
public final class PutawayTaskNotes {

    private static final Pattern PROGRESS = Pattern.compile("PUTAWAY_PROGRESS=(\\d+)/(\\d+)");
    private static final Pattern HANDLING_UNIT_QUANTITY = Pattern.compile("PUTAWAY_HU_QTY=(\\d+)");
    private static final Pattern SKIP_REASON = Pattern.compile("PUTAWAY_SKIP_REASON=([^;\\s]*)");

    private PutawayTaskNotes() {
    }

    /**
     * Units this pallet is responsible for. Empty for legacy line-scoped tasks created before
     * per-pallet splitting, where the caller must fall back to the line quantity.
     */
    public static Optional<Integer> handlingUnitQuantity(String notes) {
        return firstInt(HANDLING_UNIT_QUANTITY, notes);
    }

    /** Units of this pallet already put away; zero when the task has not been started. */
    public static int completedQuantity(String notes) {
        return firstInt(PROGRESS, notes).orElse(0);
    }

    public static Optional<String> skipReason(String notes) {
        if (notes == null || notes.isBlank()) {
            return Optional.empty();
        }
        Matcher matcher = SKIP_REASON.matcher(notes);
        if (!matcher.find()) {
            return Optional.empty();
        }
        String raw = matcher.group(1);
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(URLDecoder.decode(raw, StandardCharsets.UTF_8));
        } catch (IllegalArgumentException malformedEncoding) {
            return Optional.of(raw);
        }
    }

    private static Optional<Integer> firstInt(Pattern pattern, String notes) {
        if (notes == null || notes.isBlank()) {
            return Optional.empty();
        }
        Matcher matcher = pattern.matcher(notes);
        if (!matcher.find()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Integer.parseInt(matcher.group(1)));
        } catch (NumberFormatException notANumber) {
            return Optional.empty();
        }
    }
}
