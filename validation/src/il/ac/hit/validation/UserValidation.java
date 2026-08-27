package il.ac.hit.validation;

import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Defines a validation rule for a User entity.
 * Implements the Combinator design pattern, allowing complex validations
 * to be built by chaining simple validation rules.
 */
public interface UserValidation extends Function<User, ValidationResult> {

    /**
     * The threshold value for an email address length.
     */
    public static final int EMAIL_LENGTH_THRESHOLD = 10;

    /**
     * The threshold value for a password length.
     */
    public static final int PASSWORD_LENGTH_THRESHOLD = 8;

    /**
     * The threshold value for a user's age.
     */
    public static final int AGE_THRESHOLD = 18;

    /**
     * The threshold value for a username length.
     */
    public static final int USERNAME_LENGTH_THRESHOLD = 8;

    /**
     * The required suffix for the email address.
     */
    public static final String REQUIRED_EMAIL_SUFFIX = "il";

    /**
     * The required special character for the password.
     */
    public static final String REQUIRED_PASSWORD_SYMBOL = "$";

    private static void requireNotNull(Object object, String message) {
        if (object == null) {
            throw new ValidationException(message);
        }
    }

    private static void requireValidationsNotNull(UserValidation... validations) {
        requireNotNull(validations, "The validations array cannot be null.");
        for (UserValidation validation : validations) {
            requireNotNull(validation, "The validation element to combine cannot be null.");
        }
    }

    private static UserValidation createValidation(Predicate<User> condition, String failureReason) {
        requireNotNull(condition, "The condition cannot be null.");
        requireNotNull(failureReason, "The failure reason cannot be null.");
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            if (condition.test(user)) {
                return new Valid();
            }
            return new Invalid(failureReason);
        };
    }

    /**
     * Validates that the user's email ends with "il".
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation emailEndsWithIL() {
        return createValidation(
                user -> user.getEmail() != null && user.getEmail().endsWith(REQUIRED_EMAIL_SUFFIX),
                "Email must end with '" + REQUIRED_EMAIL_SUFFIX + "'."
        );
    }

    /**
     * Validates that the user's email length is strictly greater than the threshold.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation emailLengthBiggerThan10() {
        return createValidation(
                user -> user.getEmail() != null && user.getEmail().length() > EMAIL_LENGTH_THRESHOLD,
                "Email length must be strictly greater than " + EMAIL_LENGTH_THRESHOLD + " characters."
        );
    }

    /**
     * Validates that the user's password length is strictly greater than the threshold.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation passwordLengthBiggerThan8() {
        return createValidation(
                user -> user.getPassword() != null && user.getPassword().length() > PASSWORD_LENGTH_THRESHOLD,
                "Password length must be strictly greater than " + PASSWORD_LENGTH_THRESHOLD + " characters."
        );
    }

    /**
     * Validates that the user's password contains only letters and numbers.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation passwordIncludesLettersNumbersOnly() {
        return createValidation(
                user -> user.getPassword() != null && user.getPassword().matches("^[a-zA-Z0-9]*$"),
                "Password must contain letters and/or numbers only."
        );
    }

    /**
     * Validates that the user's password contains the required dollar sign.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation passwordIncludesDollarSign() {
        return createValidation(
                user -> user.getPassword() != null && user.getPassword().contains(REQUIRED_PASSWORD_SYMBOL),
                "Password must include a '" + REQUIRED_PASSWORD_SYMBOL + "' sign."
        );
    }

    /**
     * Validates that the user's password is not identical to their username.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation passwordIsDifferentFromUsername() {
        return createValidation(
                user -> user.getUsername() != null && user.getPassword() != null && !user.getPassword().equals(user.getUsername()),
                "Password must be different from the username."
        );
    }

    /**
     * Validates that the user's age is strictly greater than the threshold.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation ageBiggerThan18() {
        return createValidation(
                user -> user.getAge() > AGE_THRESHOLD,
                "Age must be strictly greater than " + AGE_THRESHOLD + "."
        );
    }

    /**
     * Validates that the user's username length is strictly greater than the threshold.
     *
     * @return a UserValidation instance for this rule
     */
    public static UserValidation usernameLengthBiggerThan8() {
        return createValidation(
                user -> user.getUsername() != null && user.getUsername().length() > USERNAME_LENGTH_THRESHOLD,
                "Username length must be strictly greater than " + USERNAME_LENGTH_THRESHOLD + " characters."
        );
    }

    /**
     * Logical AND combinator. Short-circuits on first failure.
     *
     * @param other another validation to chain
     * @return a combined UserValidation
     * @throws ValidationException if the validation to combine is null
     */
    public default UserValidation and(UserValidation other) {
        requireNotNull(other, "The validation to combine cannot be null.");
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            ValidationResult firstResult = this.apply(user);
            if (!firstResult.isValid()) {
                return firstResult;
            }
            return other.apply(user);
        };
    }

    /**
     * Logical OR combinator. Short-circuits on first success.
     *
     * @param other another validation to chain
     * @return a combined UserValidation
     * @throws ValidationException if the validation to combine is null
     */
    public default UserValidation or(UserValidation other) {
        requireNotNull(other, "The validation to combine cannot be null.");
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            ValidationResult firstResult = this.apply(user);
            if (firstResult.isValid()) {
                return new Valid();
            }
            ValidationResult secondResult = other.apply(user);
            if (secondResult.isValid()) {
                return new Valid();
            }
            return firstResult;
        };
    }

    /**
     * Logical XOR combinator. Evaluates both.
     *
     * @param other another validation to chain
     * @return a combined UserValidation
     * @throws ValidationException if the validation to combine is null
     */
    public default UserValidation xor(UserValidation other) {
        requireNotNull(other, "The validation to combine cannot be null.");
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            ValidationResult firstResult = this.apply(user);
            ValidationResult secondResult = other.apply(user);

            if (firstResult.isValid() && !secondResult.isValid()) {
                return new Valid();
            }
            if (!firstResult.isValid() && secondResult.isValid()) {
                return new Valid();
            }
            if (!firstResult.isValid() && !secondResult.isValid()) {
                return new Invalid("XOR failed because both validations failed");
            }
            return new Invalid("XOR failed because both validations succeeded");
        };
    }

    /**
     * Logical ALL combinator. Short-circuits on first failure.
     *
     * @param validations an array of validations
     * @return a combined UserValidation
     * @throws ValidationException if the validations array or any element is null
     */
    public static UserValidation all(UserValidation... validations) {
        requireValidationsNotNull(validations);
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            for (UserValidation validation : validations) {
                ValidationResult result = validation.apply(user);
                if (!result.isValid()) {
                    return result;
                }
            }
            return new Valid();
        };
    }

    /**
     * Logical NONE combinator. Short-circuits on first success.
     *
     * @param validations an array of validations
     * @return a combined UserValidation
     * @throws ValidationException if the validations array or any element is null
     */
    public static UserValidation none(UserValidation... validations) {
        requireValidationsNotNull(validations);
        return user -> {
            requireNotNull(user, "The user cannot be null.");
            for (UserValidation validation : validations) {
                ValidationResult result = validation.apply(user);
                if (result.isValid()) {
                    return new Invalid("NONE failed because a validation succeeded");
                }
            }
            return new Valid();
        };
    }
}
