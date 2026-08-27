package il.ac.hit.validation;

/**
 * Factory class responsible for creating specific instances of User subclasses.
 */
public class UserFactory {

/*
 * This class implements the Factory Method pattern required by the project.
 * The requested user type selects the concrete User subclass while callers
 * receive the common User abstraction.
 */

    private static final String TYPE_BASIC = "basic";
    private static final String TYPE_PREMIUM = "premium";
    private static final String TYPE_PLATINUM = "platinum";

    /**
     * Creates a specific User instance based on the provided user type string.
     *
     * @param type     the type of the user to create ("basic", "premium", "platinum")
     * @param username the primary identifier for the user
     * @param email    the user's email address
     * @param password the secret credential used for authentication
     * @param age      the user's age in years
     * @return a specific subclass of User corresponding to the type
     * @throws ValidationException if the provided type is null or unsupported
     */
    public static User createUser(String type, String username, String email, String password, int age) {
        // Validate the required factory selector before choosing a concrete user type.
        if (type == null) {
            throw new ValidationException("User type cannot be null.");
        }

        // Match only the exact type strings required by the project specification.
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
