package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserValidationTest {

    @Test
    void testEmailEndsWithIL() {
        User validUser = new User("username", "test@test.co.il", "password", 20);
        User invalidUser = new User("username", "test@test.com", "password", 20);
        
        // Valid case
        ValidationResult validResult = UserValidation.emailEndsWithIL().apply(validUser);
        assertTrue(validResult.isValid());
        assertFalse(validResult.getReason().isPresent());

        // Invalid case
        ValidationResult invalidResult = UserValidation.emailEndsWithIL().apply(invalidUser);
        assertFalse(invalidResult.isValid());
        assertTrue(invalidResult.getReason().isPresent());
    }

    @Test
    void testEmailLengthBiggerThan10() {
        // Boundary case
        User boundaryUser = new User("user", "1234567890", "password", 20);
        ValidationResult boundaryResult = UserValidation.emailLengthBiggerThan10().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        // Valid case
        User validUser = new User("user", "12345678901", "password", 20);
        ValidationResult validResult = UserValidation.emailLengthBiggerThan10().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("user", "123456789", "password", 20);
        ValidationResult invalidResult = UserValidation.emailLengthBiggerThan10().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordLengthBiggerThan8() {
        // Boundary case
        User boundaryUser = new User("user", "test@test.co.il", "12345678", 20);
        ValidationResult boundaryResult = UserValidation.passwordLengthBiggerThan8().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        // Valid case
        User validUser = new User("user", "test@test.co.il", "123456789", 20);
        ValidationResult validResult = UserValidation.passwordLengthBiggerThan8().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("user", "test@test.co.il", "1234567", 20);
        ValidationResult invalidResult = UserValidation.passwordLengthBiggerThan8().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordIncludesLettersNumbersOnly() {
        // Letters and numbers
        User lettersAndNumbersUser = new User("user", "test@test.co.il", "pass123WORD", 20);
        ValidationResult lettersAndNumbersResult = UserValidation.passwordIncludesLettersNumbersOnly()
                                                                .apply(lettersAndNumbersUser);
        assertTrue(lettersAndNumbersResult.isValid());

        // Letters only
        User lettersOnlyUser = new User("user", "test@test.co.il", "passwordOnlyLetters", 20);
        ValidationResult lettersOnlyResult = UserValidation.passwordIncludesLettersNumbersOnly()
                                                        .apply(lettersOnlyUser);
        assertTrue(lettersOnlyResult.isValid());

        // Numbers only
        User numbersOnlyUser = new User("user", "test@test.co.il", "1234567890", 20);
        ValidationResult numbersOnlyResult = UserValidation.passwordIncludesLettersNumbersOnly()
                                                        .apply(numbersOnlyUser);
        assertTrue(numbersOnlyResult.isValid());

        // Unsupported character
        User nonAlphanumericUser = new User("user", "test@test.co.il", "pass123WORD$", 20);
        ValidationResult nonAlphanumericResult = UserValidation.passwordIncludesLettersNumbersOnly()
                                                            .apply(nonAlphanumericUser);
        assertFalse(nonAlphanumericResult.isValid());

        // Empty password
        User emptyPasswordUser = new User("user", "test@test.co.il", "", 20);
        ValidationResult emptyPasswordResult = UserValidation.passwordIncludesLettersNumbersOnly()
                                                            .apply(emptyPasswordUser);
        assertTrue(emptyPasswordResult.isValid());
    }

    @Test
    void testNullUser() {
        assertThrows(ValidationException.class, () -> UserValidation.emailEndsWithIL().apply(null));
    }

    @Test
    void testPasswordIncludesDollarSign() {
        // Valid case
        User validUser = new User("user", "test@test.co.il", "pass$word", 20);
        ValidationResult validResult = UserValidation.passwordIncludesDollarSign().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("user", "test@test.co.il", "password", 20);
        ValidationResult invalidResult = UserValidation.passwordIncludesDollarSign().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordIsDifferentFromUsername() {
        // Valid case
        User validUser = new User("username", "test@test.co.il", "password", 20);
        ValidationResult validResult = UserValidation.passwordIsDifferentFromUsername().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("username", "test@test.co.il", "username", 20);
        ValidationResult invalidResult = UserValidation.passwordIsDifferentFromUsername().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testAgeBiggerThan18() {
        // Boundary case
        User boundaryUser = new User("user", "test@test.co.il", "password", 18);
        ValidationResult boundaryResult = UserValidation.ageBiggerThan18().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        // Valid case
        User validUser = new User("user", "test@test.co.il", "password", 19);
        ValidationResult validResult = UserValidation.ageBiggerThan18().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("user", "test@test.co.il", "password", 17);
        ValidationResult invalidResult = UserValidation.ageBiggerThan18().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testUsernameLengthBiggerThan8() {
        // Boundary case
        User boundaryUser = new User("username", "test@test.co.il", "password", 20); 
        ValidationResult boundaryResult = UserValidation.usernameLengthBiggerThan8().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        // Valid case
        User validUser = new User("username1", "test@test.co.il", "password", 20); 
        ValidationResult validResult = UserValidation.usernameLengthBiggerThan8().apply(validUser);
        assertTrue(validResult.isValid());

        // Invalid case
        User invalidUser = new User("user", "test@test.co.il", "password", 20);
        ValidationResult invalidResult = UserValidation.usernameLengthBiggerThan8().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testNullFieldsReturnInvalid() {
        // Null email cases
        User userWithNullEmail = new User("user", null, "password", 20);
        assertFalse(UserValidation.emailEndsWithIL().apply(userWithNullEmail).isValid());
        assertFalse(UserValidation.emailLengthBiggerThan10().apply(userWithNullEmail).isValid());

        // Null password cases
        User userWithNullPassword = new User("user", "test@test.co.il", null, 20);
        assertFalse(UserValidation.passwordLengthBiggerThan8().apply(userWithNullPassword).isValid());
        assertFalse(UserValidation.passwordIncludesLettersNumbersOnly().apply(userWithNullPassword).isValid());
        assertFalse(UserValidation.passwordIncludesDollarSign().apply(userWithNullPassword).isValid());
        assertFalse(UserValidation.passwordIsDifferentFromUsername().apply(userWithNullPassword).isValid());

        // Null username cases
        User userWithNullUsername = new User(null, "test@test.co.il", "password", 20);
        assertFalse(UserValidation.usernameLengthBiggerThan8().apply(userWithNullUsername).isValid());
        assertFalse(UserValidation.passwordIsDifferentFromUsername().apply(userWithNullUsername).isValid());
    }

    @Test
    void testAndCombinatorShortCircuit() {
        // Track whether the second validation executes.
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = firstInvalid.and(secondValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isSecondValidationExecuted[0]);
    }

    @Test
    void testAndCombinatorExecution() {
        UserValidation firstValid = user -> new Valid();
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = firstValid.and(secondInvalid).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertEquals("Second failed", result.getReason().get());
    }
    
    @Test
    void testAndCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.and(null));
        
        UserValidation andCombinator = firstValid.and(user -> new Valid());
        assertThrows(ValidationException.class, () -> andCombinator.apply(null));
    }

    @Test
    void testOrCombinatorShortCircuit() {
        // Track whether the second validation executes.
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Invalid("Second failed");
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = firstValid.or(secondValidation).apply(dummyUser);
        
        assertTrue(result.isValid());
        assertFalse(isSecondValidationExecuted[0]);
    }

    @Test
    void testOrCombinatorExecution() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValid = user -> new Valid();
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = firstInvalid.or(secondValid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }
    
    @Test
    void testOrCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.or(null));
        
        UserValidation orCombinator = firstValid.or(user -> new Valid());
        assertThrows(ValidationException.class, () -> orCombinator.apply(null));
    }

    @Test
    void testXorCombinatorEvaluatesBoth() {
        // Track whether the second validation executes.
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = firstValid.xor(secondValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertTrue(isSecondValidationExecuted[0]);
    }
    
    @Test
    void testXorCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.xor(null));
        
        UserValidation xorCombinator = firstValid.xor(user -> new Valid());
        assertThrows(ValidationException.class, () -> xorCombinator.apply(null));
    }

    @Test
    void testAllCombinatorShortCircuit() {
        // Track whether the third validation executes.
        boolean[] isThirdValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        UserValidation thirdValidation = user -> {
            isThirdValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = UserValidation.all(firstValid, secondInvalid, thirdValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isThirdValidationExecuted[0]);
    }
    
    @Test
    void testAllCombinatorNullHandling() {
        assertThrows(ValidationException.class, () -> UserValidation.all((UserValidation[]) null));
        
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> UserValidation.all(firstValid, null));
        
        assertThrows(ValidationException.class, () -> UserValidation.all().apply(null));
        assertThrows(ValidationException.class, () -> UserValidation.all(firstValid).apply(null));
    }

    @Test
    void testNoneCombinatorShortCircuit() {
        // Track whether the third validation executes.
        boolean[] isThirdValidationExecuted = {false};
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValid = user -> new Valid();
        UserValidation thirdValidation = user -> {
            isThirdValidationExecuted[0] = true;
            return new Invalid("Third failed");
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        // Combine the validations and evaluate the user.
        ValidationResult result = UserValidation.none(firstInvalid, secondValid, thirdValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isThirdValidationExecuted[0]);
    }
    
    @Test
    void testNoneCombinatorNullHandling() {
        assertThrows(ValidationException.class, () -> UserValidation.none((UserValidation[]) null));
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        assertThrows(ValidationException.class, () -> UserValidation.none(firstInvalid, null));
        
        assertThrows(ValidationException.class, () -> UserValidation.none().apply(null));
        assertThrows(ValidationException.class, () -> UserValidation.none(firstInvalid).apply(null));
    }

    @Test
    void testAndCombinatorValidAndValid() {
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValid = user -> new Valid();
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstValid.and(secondValid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testAndCombinatorInvalidAndInvalid() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.and(secondInvalid).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertEquals("First failed", result.getReason().get());
    }

    @Test
    void testOrCombinatorInvalidOrInvalid() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.or(secondInvalid).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertEquals("First failed", result.getReason().get());
    }

    @Test
    void testXorCombinatorValidXorInvalid() {
        UserValidation firstValid = user -> new Valid();
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstValid.xor(secondInvalid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testXorCombinatorInvalidXorValid() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValid = user -> new Valid();
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.xor(secondValid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testXorCombinatorInvalidXorInvalid() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.xor(secondInvalid).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertEquals("XOR failed because both validations failed", result.getReason().get());
    }

    @Test
    void testAllCombinatorEmpty() {
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.all().apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testAllCombinatorAllValid() {
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValid = user -> new Valid();
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.all(firstValid, secondValid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testNoneCombinatorEmpty() {
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.none().apply(dummyUser);
        
        assertTrue(result.isValid());
    }

    @Test
    void testNoneCombinatorAllInvalid() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.none(firstInvalid, secondInvalid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }
}
