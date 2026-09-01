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
        // Delegate initialization to User to keep shared user state in one place.
        super(username, email, password, age);
    }

    /**
     * Returns a string representation of the basic user.
     *
     * @return a descriptive text of the basic user
     */
    @Override
    public String toString() {
        // Reuse the base representation to keep formatting consistent across user types.
        return "Basic" + super.toString();
    }
}
