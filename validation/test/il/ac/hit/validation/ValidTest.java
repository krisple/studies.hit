package il.ac.hit.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ValidTest {

    @Test
    void testValidResultProperties() {
        ValidationResult result = new Valid();
        // Verify the observable contract of a successful validation result.
        assertTrue(result.isValid(), "Valid should always return true for isValid()");
        assertNotNull(result.getReason(), "Reason optional should not be null");
        assertFalse(result.getReason().isPresent(), "Valid should not have a reason present");
    }
}
