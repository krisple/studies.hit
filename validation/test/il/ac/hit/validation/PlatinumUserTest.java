package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PlatinumUserTest {

    @Test
    void testPlatinumUserCreation() {
        PlatinumUser user = new PlatinumUser("platinum", "platinum@example.com", "pass123", 20);
        assertEquals("platinum", user.getUsername());
        assertEquals("platinum@example.com", user.getEmail());
        assertEquals("pass123", user.getPassword());
        assertEquals(20, user.getAge());
    }

    @Test
    void testPlatinumUserToString() {
        PlatinumUser user = new PlatinumUser("platinum", "platinum@example.com", "pass123", 20);
        String result = user.toString();
        assertTrue(result.contains("PlatinumUser"));
        assertTrue(result.contains("platinum"));
    }
}
