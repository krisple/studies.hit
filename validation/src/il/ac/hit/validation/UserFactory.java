package il.ac.hit.validation;

/**
 * Factory class responsible for creating specific User subclasses.
 */
public final class UserFactory {

    /** Type identifier for basic users. */
    private static final String TYPE_BASIC = "basic";

    /** Type identifier for premium users. */
    private static final String TYPE_PREMIUM = "premium";

    /** Type identifier for platinum users. */
    private static final String TYPE_PLATINUM = "platinum";

    /*
     * The requested user type determines the concrete User subclass,
     * while callers receive the common User abstraction.
     */

    private UserFactory() {
        // Prevents instantiation because this class exposes static factory behavior only.
    }

    /**
     * Creates a specific User instance based on the provided user type.
     *
     * @param type the type of user to create ("basic", "premium", or "platinum")
     * @param username the primary identifier for the user
     * @param email the user's email address
     * @param password the secret credential used for authentication
     * @param age the user's age in years
     * @return a User instance corresponding to the specified type
     * @throws ValidationException if the provided type is null or unsupported
     */
    public static User createUser(String type, String username,
                                  String email, String password, int age) {

        // Reject a missing selector explicitly before choosing a concrete subtype.
        if (type == null) {
            throw new ValidationException("User type cannot be null.");
        }

        // Use only the exact selector values defined by the project specification.
        switch (type) {
            case TYPE_BASIC:
                return new BasicUser(username, email, password, age);
            case TYPE_PREMIUM:
                return new PremiumUser(username, email, password, age);
            case TYPE_PLATINUM:
                return new PlatinumUser(username, email, password, age);
            default:
                throw new ValidationException("Unsupported user type: " + type);
        }
    }
}