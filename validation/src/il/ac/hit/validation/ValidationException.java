package il.ac.hit.validation;

/**
 * Signals that a validation process failed due to a logical violation or an invalid state.
 * Serves as the primary exception type for all validation-related errors in the library.
 */
public class ValidationException extends RuntimeException {

    /**
     * Constructs a new exception with the specified message explaining the validation failure.
     *
     * @param message describes the specific reason for the validation failure
     */
    public ValidationException(String message) {
        super(message);
    }

    /**
     * Constructs a new exception with the specified message and the underlying cause.
     *
     * @param message describes the specific reason for the validation failure
     * @param cause   the underlying exception that triggered this validation error
     */
    public ValidationException(String message, Throwable cause) {
        // Preserve the original cause when wrapping a lower-level failure.
        super(message, cause);
    }

    /**
     * Provides a string representation of the validation exception, including its message.
     *
     * @return a description of the exception
     */
    @Override
    public String toString() {
        return "ValidationException{message='" + getMessage() + "'}";
    }
}
