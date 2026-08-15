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
     * @param reason the reason for the validation failure, must not be null or empty
     * @throws ValidationException if the reason is null or empty
     */
    public Invalid(String reason) {
        setReason(reason);
    }

    private void setReason(String reason) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new ValidationException("Invalid reason cannot be null or empty.");
        }
        this.reason = reason;
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
}
