package il.ac.hit.validation;

/**
 * Represents a premium user type.
 */
public class PremiumUser extends User {

    /**
     * Constructs a PremiumUser entity and initializes its core properties.
     *
     * @param username the primary identifier for the user
     * @param email    the user's email address
     * @param password the secret credential used for authentication
     * @param age      the user's age in years
     */
    public PremiumUser(String username, String email, String password, int age) {
        super(username, email, password, age);
    }

    /**
     * Returns a string representation of the premium user.
     *
     * @return a descriptive text of the premium user
     */
    @Override
    public String toString() {
        return "Premium" + super.toString();
    }
}
