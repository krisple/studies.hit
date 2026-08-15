package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PremiumUserTest {

    @Test
    void testPremiumUserCreation() {
        PremiumUser user = new PremiumUser("premium", "premium@example.com", "pass123", 20);
        assertEquals("premium", user.getUsername());
        assertEquals("premium@example.com", user.getEmail());
        assertEquals("pass123", user.getPassword());
        assertEquals(20, user.getAge());
    }

    @Test
    void testPremiumUserToString() {
        PremiumUser user = new PremiumUser("premium", "premium@example.com", "pass123", 20);
        String result = user.toString();
        assertTrue(result.contains("PremiumUser"));
        assertTrue(result.contains("premium"));
    }
}
