package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LecturerDemoTest {

    @Test
    void testLecturerDemo() {
        User user = new User("admin","admin@#yzw.co.il","abc123",34);
        UserValidation validation1 = UserValidation.emailLengthBiggerThan10();
        UserValidation validation2 = UserValidation.emailEndsWithIL();
        ValidationResult result = (validation1.and(validation2)).apply(user);
        
        // According to the sample string "admin@#yzw.co.il":
        // 1. emailLengthBiggerThan10() -> 16 characters -> Valid
        // 2. emailEndsWithIL() -> ends with "il" -> Valid
        // So validation1.and(validation2) should result in a Valid state.
        
        assertTrue(result.isValid(), "User should be valid according to the lecturer's demo logic");
    }
}
