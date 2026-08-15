package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BasicUserTest {

    @Test
    void testBasicUserCreation() {
        BasicUser user = new BasicUser("basic", "basic@example.com", "pass123", 20);
        assertEquals("basic", user.getUsername());
        assertEquals("basic@example.com", user.getEmail());
        assertEquals("pass123", user.getPassword());
        assertEquals(20, user.getAge());
    }

    @Test
    void testBasicUserToString() {
        BasicUser user = new BasicUser("basic", "basic@example.com", "pass123", 20);
        String result = user.toString();
        assertTrue(result.contains("BasicUser"));
        assertTrue(result.contains("basic"));
    }
}
