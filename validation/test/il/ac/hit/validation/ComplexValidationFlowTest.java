package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ComplexValidationFlowTest {

    @Test
    void testHighlyComplexValidUserFlow() {
        User user = new User("administrator", "super_admin_very_long@department.co.il", "Admin123$secure!", 120);

        // Build the validation groups used by the complete user validation.
        UserValidation emailValidation = UserValidation.emailEndsWithIL().and(UserValidation.emailLengthBiggerThan10());
        
        UserValidation passwordValidation = UserValidation.all(
                UserValidation.passwordLengthBiggerThan8(),
                UserValidation.passwordIsDifferentFromUsername()
        ).and(
                UserValidation.passwordIncludesDollarSign().or(UserValidation.passwordIncludesLettersNumbersOnly())
        );

        UserValidation userValidation = UserValidation.all(
                emailValidation,
                passwordValidation,
                UserValidation.usernameLengthBiggerThan8(),
                UserValidation.ageBiggerThan18()
        );

        // Evaluate the fully combined validation against the user.
        ValidationResult result = userValidation.apply(user);
        assertTrue(result.isValid(), "User should be perfectly valid in this highly complex scenario");
    }

    @Test
    void testHighlyComplexInvalidUserFlowWithXor() {
        User user = new User("shortUsr", "a@a.co.il", "abc1234$", 19);

        // XOR logic: we want EXACTLY ONE of the groups to be valid.
        UserValidation groupA = UserValidation.emailEndsWithIL().and(UserValidation.emailLengthBiggerThan10());
        
        UserValidation groupB = UserValidation.usernameLengthBiggerThan8().and(UserValidation.ageBiggerThan18());

        UserValidation xorValidation = groupA.xor(groupB);
        ValidationResult result = xorValidation.apply(user);
        
        // Both groupA and groupB are invalid, so XOR should be invalid.
        assertFalse(result.isValid(), "XOR should fail because both sides are invalid");
        assertEquals("XOR failed because both validations failed", result.getReason().get());
    }

    @Test
    void testDeeplyNestedCombinatorsShortCircuit() {
        // User designed to fail immediately on the first check to test short-circuiting
        User user = new User("admin", "admin@com", "123", 15);

        UserValidation deepValidation = UserValidation.ageBiggerThan18()
                .and(UserValidation.emailEndsWithIL())
                .and(UserValidation.usernameLengthBiggerThan8())
                .and(UserValidation.all(
                        UserValidation.passwordLengthBiggerThan8(),
                        UserValidation.passwordIncludesDollarSign()
                ));

        ValidationResult result = deepValidation.apply(user);
        assertFalse(result.isValid());
        assertTrue(result.getReason().isPresent());
    }

    @Test
    void testExtremeLargeStringsAndNumbers() {
        String longString = "a".repeat(1000);
        User user = new User(longString, longString + "@b.co.il", longString + "123$", Integer.MAX_VALUE);

        // Apply the validation rules to extreme but supported input values.
        UserValidation validation = UserValidation.all(
                UserValidation.usernameLengthBiggerThan8(),
                UserValidation.emailLengthBiggerThan10(),
                UserValidation.emailEndsWithIL(),
                UserValidation.passwordLengthBiggerThan8(),
                UserValidation.ageBiggerThan18(),
                UserValidation.passwordIncludesDollarSign()
        );

        ValidationResult result = validation.apply(user);
        assertTrue(result.isValid(), "User with extreme properties should still be validated correctly");
    }

    @Test
    void testNoneCombinatorWithMultipleFailingConditions() {
        // User that fails ALL checks
        User user = new User("usr", "short@com", "pass", 10);

        // none() should return Valid if ALL inside it fail (meaning, none of them succeed).
        UserValidation validation = UserValidation.none(
                UserValidation.ageBiggerThan18(),
                UserValidation.emailEndsWithIL(),
                UserValidation.usernameLengthBiggerThan8(),
                UserValidation.passwordLengthBiggerThan8()
        );

        ValidationResult result = validation.apply(user);
        assertTrue(result.isValid(), "none() combinator should return Valid when all internal validations fail");
    }
}
