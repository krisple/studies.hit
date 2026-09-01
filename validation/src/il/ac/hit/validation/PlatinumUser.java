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
        // Delegate initialization to User to keep shared user state in one place.
        super(username, email, password, age);
    }

    /**
     * Returns a string representation of the platinum user.
     *
     * @return a descriptive text of the platinum user
     */
    @Override
    public String toString() {
        // Reuse the base representation to keep formatting consistent across user types.
        return "Platinum" + super.toString();
    }
}
