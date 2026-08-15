package il.ac.hit.validation;

import java.util.Optional;

/**
 * Represents a successful validation result.
 */
public class Valid implements ValidationResult {

    /**
     * Constructs a new successful validation result.
     */
    public Valid() {
        // Empty constructor for instantiation
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public boolean isValid() {
        return true;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<String> getReason() {
        return Optional.empty();
    }

    /**
     * Returns a string representation of this valid result.
     *
     * @return a description of this object
     */
    @Override
    public String toString() {
        return "Valid{}";
    }
}
