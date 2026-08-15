package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ValidationExceptionTest {

    @Test
    void testMessageConstructor() {
        String message = "Validation failed";
        ValidationException exception = new ValidationException(message);
        
        assertEquals(message, exception.getMessage());
        assertNull(exception.getCause());
    }

    @Test
    void testMessageAndCauseConstructor() {
        String message = "Validation failed";
        Throwable cause = new RuntimeException("Underlying issue");
        ValidationException exception = new ValidationException(message, cause);
        
        assertEquals(message, exception.getMessage());
        assertEquals(cause, exception.getCause());
    }

    @Test
    void testToString() {
        String message = "Validation failed";
        ValidationException exception = new ValidationException(message);
        String result = exception.toString();
        
        assertTrue(result.contains(message));
        assertTrue(result.contains("ValidationException"));
    }
}
