package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import java.util.Comparator;
import static org.junit.jupiter.api.Assertions.*;

class UserUtilsTest {

    @Test
    void testSortUsersByAgeAscending() {
        User userAlice = new User("alice", "alice@example.com", "pass", 30);
        User userBob = new User("bob", "bob@example.com", "pass", 20);
        User userCharlie = new User("charlie", "charlie@example.com", "pass", 25);

        User[] users = {userAlice, userBob, userCharlie};

        UserUtils.sort(users, Comparator.comparingInt(User::getAge));

        assertEquals(userBob, users[0]);
        assertEquals(userCharlie, users[1]);
        assertEquals(userAlice, users[2]);
    }

    @Test
    void testSortUsersByUsernameAlphabetically() {
        User userCharlie = new User("charlie", "charlie@example.com", "pass", 25);
        User userAlice = new User("alice", "alice@example.com", "pass", 30);
        User userBob = new User("bob", "bob@example.com", "pass", 20);

        User[] users = {userCharlie, userAlice, userBob};

        UserUtils.sort(users, Comparator.comparing(User::getUsername));

        assertEquals(userAlice, users[0]);
        assertEquals(userBob, users[1]);
        assertEquals(userCharlie, users[2]);
    }

    @Test
    void testSortNullUsersArrayThrowsException() {
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            UserUtils.sort(null, Comparator.comparingInt(User::getAge));
        });
        assertEquals("Users array cannot be null.", exception.getMessage());
    }

    @Test
    void testSortNullComparatorThrowsException() {
        User[] users = {new User("alice", "alice@example.com", "pass", 30)};
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            UserUtils.sort(users, null);
        });
        assertEquals("Comparator cannot be null.", exception.getMessage());
    }

    @Test
    void testSortEmptyArray() {
        User[] users = {};
        UserUtils.sort(users, Comparator.comparingInt(User::getAge));
        assertEquals(0, users.length);
    }

    @Test
    void testSortSingleUserArray() {
        User userAlice = new User("alice", "alice@example.com", "pass", 30);
        User[] users = {userAlice};
        UserUtils.sort(users, Comparator.comparingInt(User::getAge));
        assertEquals(1, users.length);
        assertEquals(userAlice, users[0]);
    }
}
