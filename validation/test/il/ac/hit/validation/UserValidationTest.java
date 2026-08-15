package il.ac.hit.validation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class UserValidationTest {

    @Test
    void testEmailEndsWithIL() {
        User validUser = new User("username", "test@test.co.il", "password", 20);
        User invalidUser = new User("username", "test@test.com", "password", 20);
        
        ValidationResult validResult = UserValidation.emailEndsWithIL().apply(validUser);
        assertTrue(validResult.isValid());
        assertFalse(validResult.getReason().isPresent());

        ValidationResult invalidResult = UserValidation.emailEndsWithIL().apply(invalidUser);
        assertFalse(invalidResult.isValid());
        assertTrue(invalidResult.getReason().isPresent());
    }

    @Test
    void testEmailLengthBiggerThan10() {
        User boundaryUser = new User("user", "1234567890", "password", 20);
        ValidationResult boundaryResult = UserValidation.emailLengthBiggerThan10().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        User validUser = new User("user", "12345678901", "password", 20);
        ValidationResult validResult = UserValidation.emailLengthBiggerThan10().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "123456789", "password", 20);
        ValidationResult invalidResult = UserValidation.emailLengthBiggerThan10().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordLengthBiggerThan8() {
        User boundaryUser = new User("user", "test@test.co.il", "12345678", 20);
        ValidationResult boundaryResult = UserValidation.passwordLengthBiggerThan8().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        User validUser = new User("user", "test@test.co.il", "123456789", 20);
        ValidationResult validResult = UserValidation.passwordLengthBiggerThan8().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "test@test.co.il", "1234567", 20);
        ValidationResult invalidResult = UserValidation.passwordLengthBiggerThan8().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordIncludesLettersNumbersOnly() {
        User validUser = new User("user", "test@test.co.il", "pass123WORD", 20);
        ValidationResult validResult = UserValidation.passwordIncludesLettersNumbersOnly().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "test@test.co.il", "pass123WORD$", 20);
        ValidationResult invalidResult = UserValidation.passwordIncludesLettersNumbersOnly().apply(invalidUser);
        assertFalse(invalidResult.isValid());

        User emptyPasswordUser = new User("user", "test@test.co.il", "", 20);
        ValidationResult emptyResult = UserValidation.passwordIncludesLettersNumbersOnly().apply(emptyPasswordUser);
        assertFalse(emptyResult.isValid());
    }

    @Test
    void testNullUser() {
        assertThrows(ValidationException.class, () -> UserValidation.emailEndsWithIL().apply(null));
    }

    @Test
    void testPasswordIncludesDollarSign() {
        User validUser = new User("user", "test@test.co.il", "pass$word", 20);
        ValidationResult validResult = UserValidation.passwordIncludesDollarSign().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "test@test.co.il", "password", 20);
        ValidationResult invalidResult = UserValidation.passwordIncludesDollarSign().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testPasswordIsDifferentFromUsername() {
        User validUser = new User("username", "test@test.co.il", "password", 20);
        ValidationResult validResult = UserValidation.passwordIsDifferentFromUsername().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("username", "test@test.co.il", "username", 20);
        ValidationResult invalidResult = UserValidation.passwordIsDifferentFromUsername().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testAgeBiggerThan18() {
        User boundaryUser = new User("user", "test@test.co.il", "password", 18);
        ValidationResult boundaryResult = UserValidation.ageBiggerThan18().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        User validUser = new User("user", "test@test.co.il", "password", 19);
        ValidationResult validResult = UserValidation.ageBiggerThan18().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "test@test.co.il", "password", 17);
        ValidationResult invalidResult = UserValidation.ageBiggerThan18().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testUsernameLengthBiggerThan8() {
        User boundaryUser = new User("username", "test@test.co.il", "password", 20); 
        ValidationResult boundaryResult = UserValidation.usernameLengthBiggerThan8().apply(boundaryUser);
        assertFalse(boundaryResult.isValid());

        User validUser = new User("username1", "test@test.co.il", "password", 20); 
        ValidationResult validResult = UserValidation.usernameLengthBiggerThan8().apply(validUser);
        assertTrue(validResult.isValid());

        User invalidUser = new User("user", "test@test.co.il", "password", 20);
        ValidationResult invalidResult = UserValidation.usernameLengthBiggerThan8().apply(invalidUser);
        assertFalse(invalidResult.isValid());
    }

    @Test
    void testAndCombinatorShortCircuit() {
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.and(secondValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isSecondValidationExecuted[0]);
    }

    @Test
    void testAndCombinatorExecution() {
        UserValidation firstValid = user -> new Valid();
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstValid.and(secondInvalid).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertEquals("Second failed", result.getReason().get());
    }
    
    @Test
    void testAndCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.and(null));
    }

    @Test
    void testOrCombinatorShortCircuit() {
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Invalid("Second failed");
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstValid.or(secondValidation).apply(dummyUser);
        
        assertTrue(result.isValid());
        assertFalse(isSecondValidationExecuted[0]);
    }

    @Test
    void testOrCombinatorExecution() {
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValid = user -> new Valid();
        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstInvalid.or(secondValid).apply(dummyUser);
        
        assertTrue(result.isValid());
    }
    
    @Test
    void testOrCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.or(null));
    }

    @Test
    void testXorCombinatorEvaluatesBoth() {
        boolean[] isSecondValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondValidation = user -> {
            isSecondValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = firstValid.xor(secondValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertTrue(isSecondValidationExecuted[0]);
    }
    
    @Test
    void testXorCombinatorNullHandling() {
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> firstValid.xor(null));
    }

    @Test
    void testAllCombinatorShortCircuit() {
        boolean[] isThirdValidationExecuted = {false};
        
        UserValidation firstValid = user -> new Valid();
        UserValidation secondInvalid = user -> new Invalid("Second failed");
        UserValidation thirdValidation = user -> {
            isThirdValidationExecuted[0] = true;
            return new Valid();
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.all(firstValid, secondInvalid, thirdValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isThirdValidationExecuted[0]);
    }
    
    @Test
    void testAllCombinatorNullHandling() {
        assertThrows(ValidationException.class, () -> UserValidation.all((UserValidation[]) null));
        
        UserValidation firstValid = user -> new Valid();
        assertThrows(ValidationException.class, () -> UserValidation.all(firstValid, null));
    }

    @Test
    void testNoneCombinatorShortCircuit() {
        boolean[] isThirdValidationExecuted = {false};
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        UserValidation secondValid = user -> new Valid();
        UserValidation thirdValidation = user -> {
            isThirdValidationExecuted[0] = true;
            return new Invalid("Third failed");
        };

        User dummyUser = new User("username", "test@test.co.il", "password", 20);

        ValidationResult result = UserValidation.none(firstInvalid, secondValid, thirdValidation).apply(dummyUser);
        
        assertFalse(result.isValid());
        assertFalse(isThirdValidationExecuted[0]);
    }
    
    @Test
    void testNoneCombinatorNullHandling() {
        assertThrows(ValidationException.class, () -> UserValidation.none((UserValidation[]) null));
        
        UserValidation firstInvalid = user -> new Invalid("First failed");
        assertThrows(ValidationException.class, () -> UserValidation.none(firstInvalid, null));
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
    void testXorCombinatorInvalidAndInvalid() {
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
