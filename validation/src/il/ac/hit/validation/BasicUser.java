package il.ac.hit.validation;

/**
 * Represents a basic user type.
 */
public class BasicUser extends User {

    /**
     * Constructs a BasicUser entity and initializes its core properties.
     *
     * @param username the primary identifier for the user
     * @param email    the user's email address
     * @param password the secret credential used for authentication
     * @param age      the user's age in years
     */
    public BasicUser(String username, String email, String password, int age) {
        // Reuse the User initialization path for all shared user state.
        super(username, email, password, age);
    }

    /**
     * Returns a string representation of the basic user.
     *
     * @return a descriptive text of the basic user
     */
    @Override
    public String toString() {
        // Prefix the base representation with the concrete user type.
        return "Basic" + super.toString();
    }
}
