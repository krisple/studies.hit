package il.ac.hit.validation;

import java.util.Arrays;
import java.util.Comparator;

/**
 * Utility class providing common operations on User arrays.
 */
public class UserUtils {

    /**
     * Sorts an array of users using the provided comparator.
     *
     * @param users      the array of users to be sorted
     * @param comparator the comparison functionality to determine the order
     * @throws ValidationException if the users array or comparator is null
     */
    public static void sort(User[] users, Comparator<User> comparator) {
        if (users == null) {
            throw new ValidationException("Users array cannot be null.");
        }
        if (comparator == null) {
            throw new ValidationException("Comparator cannot be null.");
        }

        Arrays.sort(users, comparator);
    }
}
