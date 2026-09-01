package il.ac.hit.validation;

import java.util.Optional;

/**
 * Represents a failed validation result.
 */
public class Invalid implements ValidationResult {

    private String reason;

    /**
     * Constructs a new failed validation result with the given reason.
     *
     * @param reason the reason for the validation failure, must not be null or blank
     * @throws ValidationException if the reason is null or blank
     */
    public Invalid(String reason) {
        // Centralize validation to ensure every assignment follows the same rules.
        setReason(reason);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public boolean isValid() {
        return false;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<String> getReason() {
        // Construction guarantees that every invalid result has a non-null reason.
        return Optional.of(reason);
    }

    /**
     * Returns a string representation of this invalid result, including the reason.
     *
     * @return a description of this object
     */
    @Override
    public String toString() {
        return "Invalid{reason='" + reason + "'}";
    }

    private void setReason(String reason) {
        // Preserve the invariant that an invalid result always has a meaningful reason.
        if (reason == null || reason.trim().isEmpty()) {
            throw new ValidationException("Invalid reason cannot be null or blank.");
        }
        this.reason = reason;
    }
}