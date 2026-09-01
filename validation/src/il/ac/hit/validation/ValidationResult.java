package il.ac.hit.validation;

import java.util.Optional;

/**
 * Represents the result of a user validation process.
 */
public interface ValidationResult {
    /**
     * Checks whether the validation passed.
     *
     * @return true if the validation is successful, false otherwise
     */
    public abstract boolean isValid();

    // Implementations represent either a successful or a failed validation outcome.

    /**
     * Retrieves the reason for validation failure, if any.
     *
     * @return an {@link Optional} containing the failure reason if the validation failed,
     *         or an empty Optional if it passed
     */
    public abstract Optional<String> getReason();
}