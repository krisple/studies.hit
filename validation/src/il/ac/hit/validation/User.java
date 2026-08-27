package il.ac.hit.validation;

/**
 * Represents an entity that is subject to validation rules.
 * Encapsulates core identification properties that the validation library evaluates.
 */
public class User {

    private String username;
    private String email;
    private String password;
    private int age;

    /**
     * Constructs a User entity and initializes its core properties.
     *
     * @param username the primary identifier for the user
     * @param email    the user's email address
     * @param password the secret credential used for authentication
     * @param age      the user's age in years
     */
    public User(String username, String email, String password, int age) {
        setUsername(username);
        setEmail(email);
        setPassword(password);
        setAge(age);
    }

    /**
     * Retrieves the primary identifier of the user.
     *
     * @return the username
     */
    public String getUsername() {
        return username;
    }

    /**
     * Updates the user's primary identifier.
     *
     * @param username the new primary identifier
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Retrieves the user's email address.
     *
     * @return the email address
     */
    public String getEmail() {
        return email;
    }

    /**
     * Updates the user's email address.
     *
     * @param email the new email address
     */
    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Retrieves the user's authentication credential.
     *
     * @return the password
     */
    public String getPassword() {
        return password;
    }

    /**
     * Updates the user's authentication credential.
     *
     * @param password the new password
     */
    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * Retrieves the user's age.
     *
     * @return the age in years
     */
    public int getAge() {
        return age;
    }

    /**
     * Updates the user's age.
     *
     * @param age the new age in years
     */
    public void setAge(int age) {
        this.age = age;
    }

    /**
     * Returns a string representation of the user containing their state.
     *
     * @return a descriptive text of the user's properties
     */
    @Override
    public String toString() {
        return "User{" +
                "username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", password='" + password + '\'' +
                ", age=" + age +
                '}';
    }
}
