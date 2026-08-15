package il.ac.hit.validation;

import java.util.Optional;

/**
 * Represents the result of a user validation process.
 */
public interface ValidationResult {

    /**
     * Checks if the validation passed.
     *
     * @return true if the validation is successful, false otherwise.
     */
    boolean isValid();

    /**
     * Retrieves the reason for validation failure, if any.
     *
     * @return an {@link Optional} containing the failure reason if the validation failed,
     *         or an empty Optional if it passed.
     */
    Optional<String> getReason();
}
