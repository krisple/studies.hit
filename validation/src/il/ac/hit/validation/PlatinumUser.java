package il.ac.hit.validation;

/**
 * Represents a platinum user type.
 */
public class PlatinumUser extends User {

    /**
     * Constructs a PlatinumUser entity and initializes its core properties.
     *
     * @param username the primary identifier for the user
     * @param email    the user's email address
     * @param password the secret credential used for authentication
     * @param age      the user's age in years
     */
    public PlatinumUser(String username, String email, String password, int age) {
        // Reuse the User initialization path for all shared user state.
        super(username, email, password, age);
    }

    /**
     * Returns a string representation of the platinum user.
     *
     * @return a descriptive text of the platinum user
     */
    @Override
    public String toString() {
        // Prefix the base representation with the concrete user type.
        return "Platinum" + super.toString();
    }
}
