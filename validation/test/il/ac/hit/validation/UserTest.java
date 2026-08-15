package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserTest {

    @Test
    void testValidUserCreation() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        assertEquals("admin", user.getUsername());
        assertEquals("admin@hit.ac.il", user.getEmail());
        assertEquals("pass123", user.getPassword());
        assertEquals(25, user.getAge());
    }

    @Test
    void testNullUsernameThrowsException() {
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            new User(null, "admin@hit.ac.il", "pass123", 25);
        });
        assertNotNull(exception.getMessage());
    }

    @Test
    void testNullEmailThrowsException() {
        assertThrows(ValidationException.class, () -> {
            new User("admin", null, "pass123", 25);
        });
    }

    @Test
    void testNullPasswordThrowsException() {
        assertThrows(ValidationException.class, () -> {
            new User("admin", "admin@hit.ac.il", null, 25);
        });
    }

    @Test
    void testToStringContainsProperties() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        String result = user.toString();
        assertTrue(result.contains("admin"));
        assertTrue(result.contains("admin@hit.ac.il"));
        assertTrue(result.contains("pass123"));
        assertTrue(result.contains("25"));
    }

    @Test
    void testSettersAndGetters() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        
        user.setUsername("newAdmin");
        assertEquals("newAdmin", user.getUsername());
        
        user.setEmail("new@hit.ac.il");
        assertEquals("new@hit.ac.il", user.getEmail());
        
        user.setPassword("newPass");
        assertEquals("newPass", user.getPassword());
        
        user.setAge(30);
        assertEquals(30, user.getAge());
    }

    @Test
    void testSetNullUsernameThrowsException() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        assertThrows(ValidationException.class, () -> user.setUsername(null));
    }

    @Test
    void testSetNullEmailThrowsException() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        assertThrows(ValidationException.class, () -> user.setEmail(null));
    }

    @Test
    void testSetNullPasswordThrowsException() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        assertThrows(ValidationException.class, () -> user.setPassword(null));
    }
}
