package il.ac.hit.xpool;

/**
 * Custom runtime exception for the xpool library.
 * This exception is used to wrap and report failures within the thread pool.
 */
public class XPoolException extends RuntimeException {

    /**
     * Constructs a new exception with the specified detail message.
     * 
     * @param message The detail message describing the failure.
     */
    public XPoolException(String message) {
        super(message);
    }

    /**
     * Constructs a new exception with the specified detail message and cause.
     * 
     * @param message The detail message describing the failure.
     * @param cause The underlying cause of the failure.
     */
    public XPoolException(String message, Throwable cause) {
        super(message, cause);
    }
}
