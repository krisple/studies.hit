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
    void testNullUsernameAllowed() {
        User user = new User(null, "admin@hit.ac.il", "pass123", 25);
        assertNull(user.getUsername());
    }

    @Test
    void testNullEmailAllowed() {
        User user = new User("admin", null, "pass123", 25);
        assertNull(user.getEmail());
    }

    @Test
    void testNullPasswordAllowed() {
        User user = new User("admin", "admin@hit.ac.il", null, 25);
        assertNull(user.getPassword());
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
    void testSetNullUsernameAllowed() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        user.setUsername(null);
        assertNull(user.getUsername());
    }

    @Test
    void testSetNullEmailAllowed() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        user.setEmail(null);
        assertNull(user.getEmail());
    }

    @Test
    void testSetNullPasswordAllowed() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        user.setPassword(null);
        assertNull(user.getPassword());
    }

    @Test
    void testNegativeAgeInConstructor() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", -5);
        assertEquals(-5, user.getAge());
    }

    @Test
    void testSetNegativeAge() {
        User user = new User("admin", "admin@hit.ac.il", "pass123", 25);
        user.setAge(-10);
        assertEquals(-10, user.getAge());
    }
}
