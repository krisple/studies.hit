package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserFactoryTest {

    @Test
    void testCreateBasicUser() {
        User user = UserFactory.createUser("basic", "john_doe", "john@example.com", "pass123", 25);
        assertTrue(user instanceof BasicUser);
        assertEquals("john_doe", user.getUsername());
        assertEquals("john@example.com", user.getEmail());
        assertEquals("pass123", user.getPassword());
        assertEquals(25, user.getAge());
    }

    @Test
    void testCreatePremiumUser() {
        User user = UserFactory.createUser("premium", "jane_doe", "jane@example.com", "pass456", 30);
        assertTrue(user instanceof PremiumUser);
        assertEquals("jane_doe", user.getUsername());
        assertEquals("jane@example.com", user.getEmail());
        assertEquals("pass456", user.getPassword());
        assertEquals(30, user.getAge());
    }

    @Test
    void testCreatePlatinumUser() {
        User user = UserFactory.createUser("platinum", "alex_smith", "alex@example.com", "pass789", 40);
        assertTrue(user instanceof PlatinumUser);
        assertEquals("alex_smith", user.getUsername());
        assertEquals("alex@example.com", user.getEmail());
        assertEquals("pass789", user.getPassword());
        assertEquals(40, user.getAge());
    }

    @Test
    void testCreateUnsupportedUserTypeThrowsException() {
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            UserFactory.createUser("gold", "test", "test@test.com", "pass", 20);
        });
        assertEquals("Unsupported user type: gold", exception.getMessage());
    }

    @Test
    void testCreateNullUserTypeThrowsException() {
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            UserFactory.createUser(null, "test", "test@test.com", "pass", 20);
        });
        assertEquals("User type cannot be null.", exception.getMessage());
    }
}
