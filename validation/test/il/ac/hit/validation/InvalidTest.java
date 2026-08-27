package il.ac.hit.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvalidTest {

    @Test
    void testInvalidResultProperties() {
        String expectedReason = "Invalid username";
        ValidationResult result = new Invalid(expectedReason);
        
        // Verify the observable contract of a failed validation result.
        assertFalse(result.isValid(), "Invalid should always return false for isValid()");
        assertTrue(result.getReason().isPresent(), "Invalid should always have a reason present");
        assertEquals(expectedReason, result.getReason().get(), "Reason should match the expected string");
    }

    @Test
    void testInvalidResultNullReason() {
        ValidationException exception = assertThrows(ValidationException.class, () -> new Invalid(null));
        assertEquals("Invalid reason cannot be null or empty.", exception.getMessage());
    }

    @Test
    void testInvalidResultEmptyReason() {
        ValidationException exception = assertThrows(ValidationException.class, () -> new Invalid("   "));
        assertEquals("Invalid reason cannot be null or empty.", exception.getMessage());
    }
}
